import io
from datetime import datetime
from flask import Blueprint, request, jsonify, g, send_file, current_app

api = Blueprint('api', __name__)

def get_db():
    if 'db' not in g:
        from app import get_db as app_get_db
        return app_get_db()
    return g.db

def dict_from_row(row):
    return dict(row) if row else None

# // ---- Health ----
@api.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

# // ---- Profiles ----
@api.route('/profiles', methods=['GET'])
def get_profiles():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id, name, role, district, created_at FROM profiles ORDER BY id ASC")
    rows = cur.fetchall()
    return jsonify([dict_from_row(r) for r in rows])

@api.route('/profiles', methods=['POST'])
def create_profile():
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    if not name or not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Profile name is required"}), 400

    role = data.get('role', 'self')
    if role not in ('self', 'caregiver'):
        return jsonify({"error": "Role must be 'self' or 'caregiver'"}), 400

    district = data.get('district') or None

    db = get_db()
    cur = db.cursor()
    cur.execute(
        "INSERT INTO profiles (name, role, district) VALUES (?, ?, ?)",
        (name.strip(), role, district)
    )
    db.commit()
    new_id = cur.lastrowid
    cur.execute("SELECT id, name, role, district, created_at FROM profiles WHERE id = ?", (new_id,))
    profile = cur.fetchone()
    return jsonify(dict_from_row(profile)), 201

@api.route('/profiles/<int:profile_id>', methods=['PATCH'])
def update_profile(profile_id):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id, name, role, district, created_at FROM profiles WHERE id = ?", (profile_id,))
    profile = cur.fetchone()
    if not profile:
        return jsonify({"error": "Profile not found"}), 404

    data = request.get_json(silent=True) or {}
    name = data.get('name', profile['name'])
    role = data.get('role', profile['role'])
    district = data.get('district', profile['district'])

    if role not in ('self', 'caregiver'):
        return jsonify({"error": "Role must be 'self' or 'caregiver'"}), 400

    cur.execute(
        "UPDATE profiles SET name = ?, role = ?, district = ? WHERE id = ?",
        (name, role, district, profile_id)
    )
    db.commit()
    cur.execute("SELECT id, name, role, district, created_at FROM profiles WHERE id = ?", (profile_id,))
    updated = cur.fetchone()
    return jsonify(dict_from_row(updated))

@api.route('/profiles/<int:profile_id>/data', methods=['DELETE'])
def delete_profile_data(profile_id):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM profiles WHERE id = ?", (profile_id,))
    if not cur.fetchone():
        return jsonify({"error": "Profile not found"}), 404

    cur.execute("DELETE FROM attacks WHERE profile_id = ?", (profile_id,))
    cur.execute("DELETE FROM checkins WHERE profile_id = ?", (profile_id,))
    db.commit()
    return jsonify({"deleted": True})

@api.route('/profiles/<int:profile_id>', methods=['DELETE'])
def delete_profile(profile_id):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM profiles WHERE id = ?", (profile_id,))
    if not cur.fetchone():
        return jsonify({"error": "Profile not found"}), 404

    cur.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
    db.commit()
    return jsonify({"deleted": True})

# // ---- Attacks ----
@api.route('/attacks', methods=['POST'])
def log_attack():
    data = request.get_json(silent=True) or {}
    profile_id = data.get('profile_id', 1)
    district = data.get('district')
    if not district:
        return jsonify({"error": "District is required"}), 400

    attacked_at_raw = data.get('attacked_at')
    live = data.get('live', False)

    now = datetime.now()
    if not attacked_at_raw or live:
        attacked_at = now.strftime('%Y-%m-%dT%H:%M:%S')
        logged_later = 0
    else:
        # User specified an attack time in the past
        try:
            # support ISO formats with or without seconds
            att_dt = datetime.fromisoformat(attacked_at_raw.replace('Z', ''))
        except ValueError:
            return jsonify({"error": "Invalid attacked_at date format"}), 400

        if att_dt > now:
            return jsonify({"error": "Cannot log an attack in the future"}), 400

        attacked_at = att_dt.strftime('%Y-%m-%dT%H:%M:%S')
        logged_later = 1

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM profiles WHERE id = ?", (profile_id,))
    if not cur.fetchone():
        return jsonify({"error": "Profile not found"}), 404

    cur.execute(
        """
        INSERT INTO attacks (profile_id, attacked_at, district, logged_later)
        VALUES (?, ?, ?, ?)
        """,
        (profile_id, attacked_at, district, logged_later)
    )
    db.commit()
    attack_id = cur.lastrowid
    cur.execute("SELECT * FROM attacks WHERE id = ?", (attack_id,))
    new_attack = cur.fetchone()
    return jsonify(dict_from_row(new_attack)), 201

@api.route('/attacks/<int:attack_id>', methods=['PATCH'])
def update_attack(attack_id):
    data = request.get_json(silent=True) or {}
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM attacks WHERE id = ?", (attack_id,))
    attack = cur.fetchone()
    if not attack:
        return jsonify({"error": "Attack not found"}), 404

    severity = data.get('severity', attack['severity'])
    if severity is not None and severity not in ('mild', 'moderate', 'severe'):
        return jsonify({"error": "Severity must be 'mild', 'moderate', or 'severe'"}), 400

    inhaler_used = data.get('inhaler_used', attack['inhaler_used'])
    if inhaler_used is not None:
        if isinstance(inhaler_used, bool):
            inhaler_used = 1 if inhaler_used else 0
        elif inhaler_used not in (0, 1):
            return jsonify({"error": "inhaler_used must be boolean or 0/1"}), 400

    cur.execute(
        "UPDATE attacks SET severity = ?, inhaler_used = ? WHERE id = ?",
        (severity, inhaler_used, attack_id)
    )
    db.commit()
    cur.execute("SELECT * FROM attacks WHERE id = ?", (attack_id,))
    return jsonify(dict_from_row(cur.fetchone()))

@api.route('/attacks', methods=['GET'])
def get_attacks():
    profile_id = request.args.get('profile_id', type=int)
    db = get_db()
    cur = db.cursor()
    if profile_id:
        cur.execute(
            "SELECT * FROM attacks WHERE profile_id = ? ORDER BY attacked_at DESC, id DESC",
            (profile_id,)
        )
    else:
        cur.execute("SELECT * FROM attacks ORDER BY attacked_at DESC, id DESC")
    rows = cur.fetchall()
    return jsonify([dict_from_row(r) for r in rows])

# // ---- Check-ins ----
@api.route('/checkins', methods=['POST'])
def save_checkin():
    data = request.get_json(silent=True) or {}
    profile_id = data.get('profile_id', 1)
    if 'had_symptoms' not in data:
        return jsonify({"error": "had_symptoms is required"}), 400

    had_symptoms = data.get('had_symptoms')
    if isinstance(had_symptoms, bool):
        had_symptoms = 1 if had_symptoms else 0
    elif had_symptoms not in (0, 1):
        return jsonify({"error": "had_symptoms must be boolean or 0/1"}), 400

    checkin_date = data.get('checkin_date')
    if not checkin_date:
        checkin_date = datetime.now().strftime('%Y-%m-%d')
    else:
        # validate format
        try:
            datetime.strptime(checkin_date, '%Y-%m-%d')
        except ValueError:
            return jsonify({"error": "checkin_date must be in YYYY-MM-DD format"}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM profiles WHERE id = ?", (profile_id,))
    if not cur.fetchone():
        return jsonify({"error": "Profile not found"}), 404

    cur.execute(
        """
        INSERT INTO checkins (profile_id, checkin_date, had_symptoms)
        VALUES (?, ?, ?)
        ON CONFLICT(profile_id, checkin_date) DO UPDATE SET
            had_symptoms = excluded.had_symptoms,
            created_at = CURRENT_TIMESTAMP
        """,
        (profile_id, checkin_date, had_symptoms)
    )
    db.commit()

    cur.execute(
        "SELECT * FROM checkins WHERE profile_id = ? AND checkin_date = ?",
        (profile_id, checkin_date)
    )
    return jsonify(dict_from_row(cur.fetchone())), 201

@api.route('/checkins', methods=['GET'])
def get_checkins():
    profile_id = request.args.get('profile_id', type=int)
    from_date = request.args.get('from')
    to_date = request.args.get('to')

    query = "SELECT * FROM checkins WHERE 1=1"
    params = []

    if profile_id:
        query += " AND profile_id = ?"
        params.append(profile_id)
    if from_date:
        query += " AND checkin_date >= ?"
        params.append(from_date)
    if to_date:
        query += " AND checkin_date <= ?"
        params.append(to_date)

    query += " ORDER BY checkin_date DESC"

    db = get_db()
    cur = db.cursor()
    cur.execute(query, params)
    rows = cur.fetchall()
    return jsonify([dict_from_row(r) for r in rows])

# // ---- Patterns ----
@api.route('/patterns', methods=['GET'])
def get_patterns():
    profile_id = request.args.get('profile_id', default=1, type=int)
    from analysis import run_analysis
    res = run_analysis(profile_id=profile_id)
    return jsonify(res)

# // ---- Report ----
@api.route('/report', methods=['GET'])
def get_report():
    profile_id = request.args.get('profile_id', default=1, type=int)
    from report import build_report_pdf
    pdf_bytes = build_report_pdf(profile_id)
    if pdf_bytes is None:
        return jsonify({"error": "Profile not found"}), 404

    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f"triggertrace_summary_profile_{profile_id}.pdf"
    )
