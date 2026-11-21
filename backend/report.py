import io
import xml.sax.saxutils as saxutils
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from flask import current_app, g

def get_db():
    if 'db' not in g:
        from app import get_db as app_get_db
        return app_get_db()
    return g.db

def esc(text):
    if text is None:
        return ""
    return saxutils.escape(str(text))

def build_report_pdf(profile_id):
    db = get_db()
    cur = db.cursor()

    cur.execute("SELECT id, name, role, district FROM profiles WHERE id = ?", (profile_id,))
    profile = cur.fetchone()
    if not profile:
        return None

    cur.execute("SELECT COUNT(*) as count FROM attacks WHERE profile_id = ?", (profile_id,))
    total_attacks = cur.fetchone()['count']

    cur.execute(
        """
        SELECT attacked_at, severity, inhaler_used, logged_later
        FROM attacks
        WHERE profile_id = ?
        ORDER BY attacked_at DESC
        LIMIT 15
        """,
        (profile_id,)
    )
    recent_attacks = cur.fetchall()

    from analysis import run_analysis, DISCLAIMER
    analysis_res = run_analysis(profile_id)

    data_label = current_app.config.get('DATA_LABEL', 'Synthetic demo data') if current_app else 'Synthetic demo data'

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#102A38'),
        spaceAfter=4
    )
    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#526773'),
        spaceAfter=10
    )
    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#178578'),
        spaceBefore=8,
        spaceAfter=4
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#102A38')
    )
    emergency_style = ParagraphStyle(
        'EmergencyNotice',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#B91C1C')
    )
    disclaimer_style = ParagraphStyle(
        'Disclaimer',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#526773')
    )

    story = []

    # Title & Metadata
    story.append(Paragraph("TriggerTrace: Doctor Summary", title_style))
    prep_date = datetime.now().strftime('%d %b %Y, %H:%M')
    meta_text = f"<b>Patient:</b> {esc(profile['name'])} ({esc(profile['role'])}) &nbsp;&nbsp;|&nbsp;&nbsp; <b>District:</b> {esc(profile['district'] or 'Not set')} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Prepared:</b> {esc(prep_date)}"
    story.append(Paragraph(meta_text, meta_style))

    # Emergency-first reminder
    emergency_box = [
        [Paragraph("<b>Emergency notice:</b> During a severe attack, follow your asthma action plan or call emergency services first.", emergency_style)]
    ]
    t_emerg = Table(emergency_box, colWidths=[523])
    t_emerg.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FEF2F2')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#B91C1C')),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_emerg)
    story.append(Spacer(1, 8))

    # Possible Patterns section
    story.append(Paragraph("Environmental Pattern Analysis", h2_style))
    if analysis_res.get('status') == 'ok':
        story.append(Paragraph(esc(analysis_res.get('confidence_note', '')), body_style))
        story.append(Spacer(1, 4))

        pattern_data = [["Factor", "Odds Ratio per SD", "95% Range", "Pattern Verdict"]]
        for f in analysis_res.get('factors', []):
            pattern_data.append([
                esc(f.get('label', f.get('factor'))),
                str(f.get('odds_ratio', '-')),
                f"{f.get('range_low', '-')} to {f.get('range_high', '-')}",
                esc(f.get('verdict', '-'))
            ])
        t_patterns = Table(pattern_data, colWidths=[180, 110, 110, 123])
        t_patterns.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E3F3F1')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#178578')),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ]))
        story.append(t_patterns)
    else:
        msg = analysis_res.get('message', 'Not enough data logged yet to detect patterns.')
        story.append(Paragraph(f"<i>{esc(msg)}</i>", body_style))

    story.append(Spacer(1, 8))

    # Attacks section
    story.append(Paragraph(f"Recent Attacks (Total Logged: {total_attacks})", h2_style))
    if recent_attacks:
        attack_table_data = [["Date & Time", "Severity", "Inhaler Used", "Logging Mode"]]
        for att in recent_attacks:
            dt_display = att['attacked_at'].replace('T', ' ')[:16]
            sev = (att['severity'] or 'Unspecified').capitalize()
            inh = 'Yes' if att['inhaler_used'] == 1 else ('No' if att['inhaler_used'] == 0 else 'Unspecified')
            mode = 'Logged later' if att['logged_later'] == 1 else 'At the time'
            attack_table_data.append([esc(dt_display), esc(sev), esc(inh), esc(mode)])

        t_attacks = Table(attack_table_data, colWidths=[150, 110, 110, 153])
        t_attacks.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F2F6F8')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#102A38')),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ]))
        story.append(t_attacks)
    else:
        story.append(Paragraph("<i>No attacks logged yet.</i>", body_style))

    story.append(Spacer(1, 8))

    # Disclaimer & Data Label
    story.append(Paragraph(f"<b>Disclaimer:</b> {esc(DISCLAIMER)}", disclaimer_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"<b>Data Note:</b> {esc(data_label)}", disclaimer_style))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
