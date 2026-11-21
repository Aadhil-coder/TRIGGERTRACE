import os
import sys
import csv
import argparse
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
import numpy as np

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR.parent / 'backend'
sys.path.insert(0, str(BACKEND_DIR))

from app import create_app, init_db

HOURLY_CSV = BASE_DIR / 'cache' / 'synthetic_environment_hourly.csv'
DAILY_CSV = BASE_DIR / 'synthetic_sample.csv'
DISTRICT = 'Coimbatore (synthetic)'
START_DATE = '2026-08-01'
DAYS = 90

def generate():
    """
    Generates synthetic hourly environment data and daily sample data.
    Seed: 42
    90 days from 2026-08-01 to 2026-10-29.
    Targets: 16 attack days, 75 check-in days, 61 symptom-free days.
    Planted pattern: logit = -1.4 + 0.035*(yesterday_pm2_5 - 35) + 0.03*(humidity - 60).
    """
    rng = np.random.default_rng(42)
    start_dt = datetime.strptime(START_DATE, '%Y-%m-%d')
    
    os.makedirs(BASE_DIR / 'cache', exist_ok=True)
    
    # 1. Base climate series for 90 days with seasonal curves and noise
    daily_t_base = 27.0 + 2.0 * np.sin(np.linspace(0, 1.5 * np.pi, DAYS)) + rng.normal(0, 0.6, DAYS)
    daily_h_base = 62.0 + 9.0 * np.cos(np.linspace(0, 1.5 * np.pi, DAYS)) + rng.normal(0, 1.8, DAYS)
    daily_p_base = 35.0 + 7.0 * np.sin(np.linspace(0, 3.0 * np.pi, DAYS)) + rng.normal(0, 2.5, DAYS)
    
    # Independent rainfall distribution
    rain_rng = np.random.default_rng(1)
    daily_rain_event = rain_rng.random(DAYS) < 0.15
    daily_rain_amount = np.where(daily_rain_event, rain_rng.exponential(2.0, DAYS), 0.0)
    
    hourly_rows = []
    daily_rows = []
    
    for d in range(DAYS):
        cur_dt = start_dt + timedelta(days=d)
        date_str = cur_dt.strftime('%Y-%m-%d')
        
        t_base = daily_t_base[d]
        h_base = daily_h_base[d]
        p_base = daily_p_base[d]
        rain_tot = daily_rain_amount[d]
        
        h_t = []
        h_h = []
        h_p = []
        h_r = []
        
        for h in range(24):
            obs_time = f"{date_str}T{h:02d}:00"
            temp = round(float(t_base + 3.8 * np.sin(np.pi * (h - 8) / 12.0) + rng.normal(0, 0.2)), 1)
            hum = round(float(np.clip(h_base - 10.0 * np.sin(np.pi * (h - 8) / 12.0) + rng.normal(0, 0.5), 25.0, 95.0)), 1)
            rush = 6.0 * (np.exp(-0.5 * ((h - 8) / 2.0)**2) + np.exp(-0.5 * ((h - 20) / 2.0)**2))
            pm = round(float(max(8.0, p_base + rush + rng.normal(0, 1.0))), 1)
            rain_h = round(float(rain_tot / 3.0 if (15 <= h <= 17 and rain_tot > 0) else 0.0), 1)
            
            hourly_rows.append({
                'district': DISTRICT,
                'observed_at': obs_time,
                'pm2_5': pm,
                'humidity': hum,
                'temperature': temp,
                'rainfall': rain_h,
                'source': 'synthetic'
            })
            h_t.append(temp)
            h_h.append(hum)
            h_p.append(pm)
            h_r.append(rain_h)
            
        daily_rows.append({
            'date': date_str,
            'pm2_5': round(float(np.mean(h_p)), 1),
            'humidity': round(float(np.mean(h_h)), 1),
            'temperature': round(float(np.mean(h_t)), 1),
            'rainfall': round(float(np.sum(h_r)), 1)
        })
        
    # Planted pattern for attacks:
    # logit = -1.4 + 0.035*(yesterday_pm2_5 - 35) + 0.03*(humidity - 60)
    yesterday_pm2_5 = 35.0
    logits = []
    for d in range(DAYS):
        h_val = daily_rows[d]['humidity']
        p_val = daily_rows[d]['pm2_5']
        logit = -1.4 + 0.015 * (yesterday_pm2_5 - 35.0) + 0.035 * (h_val - 60.0)
        logits.append(logit)
        yesterday_pm2_5 = p_val
        
    scores = np.array(logits) + rng.normal(0, 0.35, DAYS)
    attack_indices = set(np.argsort(scores)[-16:])
    
    checkin_scores = rng.random(DAYS)
    checkin_indices = set(np.argsort(checkin_scores)[-75:])
    
    att_in_chk = list(checkin_indices & attack_indices)
    att_not_chk = list(attack_indices - checkin_indices)
    
    while len(att_in_chk) > 12:
        move_att = att_in_chk.pop()
        checkin_indices.remove(move_att)
        non_cand = [i for i in range(DAYS) if i not in checkin_indices and i not in attack_indices]
        checkin_indices.add(non_cand[0])
    while len(att_in_chk) < 12:
        move_att = att_not_chk.pop()
        checkin_indices.add(move_att)
        cand = [i for i in checkin_indices if i not in attack_indices]
        checkin_indices.remove(cand[0])
        att_in_chk.append(move_att)
        
    non_att_chk_days = sorted([i for i in checkin_indices if i not in attack_indices])
    symptom_days = set(non_att_chk_days[:2])
    
    for d in range(DAYS):
        is_att = 1 if d in attack_indices else 0
        is_chk = 1 if d in checkin_indices else 0
        if is_chk == 1:
            if is_att == 1:
                had_sym = 1
            elif d in symptom_days:
                had_sym = 1
            else:
                had_sym = 0
        else:
            had_sym = ""
            
        daily_rows[d]['attack'] = is_att
        daily_rows[d]['checked_in'] = is_chk
        daily_rows[d]['had_symptoms'] = had_sym
        
    # Write hourly CSV (Unix line endings \n)
    with open(HOURLY_CSV, 'w', newline='\n', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['district', 'observed_at', 'pm2_5', 'humidity', 'temperature', 'rainfall', 'source'], lineterminator='\n')
        writer.writeheader()
        writer.writerows(hourly_rows)
        
    # Write daily CSV (Unix line endings \n)
    with open(DAILY_CSV, 'w', newline='\n', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['date', 'pm2_5', 'humidity', 'temperature', 'rainfall', 'attack', 'checked_in', 'had_symptoms'], lineterminator='\n')
        writer.writeheader()
        writer.writerows(daily_rows)
        
    n_attacks = sum(r['attack'] for r in daily_rows)
    n_checkins = sum(r['checked_in'] for r in daily_rows)
    n_symptom_free = sum(1 for r in daily_rows if r['checked_in'] == 1 and r['had_symptoms'] == 0 and r['attack'] == 0)
    
    print(f"Generated synthetic demo data:")
    print(f"  Hourly rows: {len(hourly_rows)} -> {HOURLY_CSV}")
    print(f"  Daily rows:  {len(daily_rows)} -> {DAILY_CSV}")
    print(f"  Counts: {n_attacks} attack days, {n_checkins} check-in days, {n_symptom_free} symptom-free days.")

def load(reset=False):
    """
    Loads synthetic demo data into SQLite database.
    """
    if not HOURLY_CSV.exists() or not DAILY_CSV.exists():
        print("Data files not found. Running generate first...")
        generate()
        
    app = create_app()
    db_path = app.config['DATABASE_PATH']
    
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()
    
    if reset:
        print("Resetting database...")
        cur.execute("DELETE FROM attacks;")
        cur.execute("DELETE FROM checkins;")
        cur.execute("DELETE FROM environment_cache WHERE district = ?;", (DISTRICT,))
        conn.commit()
    else:
        # Check if already loaded
        cur.execute("SELECT COUNT(*) FROM attacks WHERE district = ?", (DISTRICT,))
        if cur.fetchone()[0] > 0:
            print("Demo data already loaded. Use --reset to reload.")
            conn.close()
            return
            
    # Set profile 1 to Demo user
    cur.execute("SELECT id FROM profiles WHERE id = 1")
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO profiles (id, name, role, district) VALUES (1, 'Demo user', 'self', ?)",
            (DISTRICT,)
        )
    else:
        cur.execute(
            "UPDATE profiles SET name = 'Demo user', role = 'self', district = ? WHERE id = 1",
            (DISTRICT,)
        )
    conn.commit()
    
    # Load hourly environment rows
    print(f"Loading hourly environment cache from {HOURLY_CSV}...")
    with open(HOURLY_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cur.execute(
                """
                INSERT OR REPLACE INTO environment_cache
                (district, observed_at, pm2_5, humidity, temperature, rainfall, source, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    row['district'],
                    row['observed_at'],
                    float(row['pm2_5']) if row['pm2_5'] else None,
                    float(row['humidity']) if row['humidity'] else None,
                    float(row['temperature']) if row['temperature'] else None,
                    float(row['rainfall']) if row['rainfall'] else None,
                    row['source']
                )
            )
    conn.commit()
    
    # Load daily attacks and check-ins
    print(f"Loading attacks and check-ins from {DAILY_CSV}...")
    severity_cycle = ['mild', 'moderate', 'severe']
    attack_count = 0
    checkin_count = 0
    symptom_free_count = 0
    
    with open(DAILY_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            date_str = row['date']
            is_attack = int(row['attack'])
            is_checked_in = int(row['checked_in'])
            had_sym = row['had_symptoms']
            
            if is_attack == 1:
                severity = severity_cycle[attack_count % 3]
                inhaler = 0 if severity == 'mild' else 1
                attacked_at = f"{date_str}T14:00:00"
                cur.execute(
                    """
                    INSERT INTO attacks (profile_id, attacked_at, district, severity, inhaler_used, logged_later)
                    VALUES (1, ?, ?, ?, ?, 0)
                    """,
                    (attacked_at, DISTRICT, severity, inhaler)
                )
                attack_count += 1
                
            if is_checked_in == 1:
                sym_val = int(had_sym) if had_sym != '' else 0
                cur.execute(
                    """
                    INSERT INTO checkins (profile_id, checkin_date, had_symptoms)
                    VALUES (1, ?, ?)
                    ON CONFLICT(profile_id, checkin_date) DO UPDATE SET had_symptoms = excluded.had_symptoms
                    """,
                    (date_str, sym_val)
                )
                checkin_count += 1
                if sym_val == 0 and is_attack == 0:
                    symptom_free_count += 1
                    
    conn.commit()
    conn.close()
    
    print("Database load complete:")
    print(f"  Attack days: {attack_count}")
    print(f"  Check-in days: {checkin_count}")
    print(f"  Symptom-free days: {symptom_free_count}")

def main():
    parser = argparse.ArgumentParser(description="TriggerTrace synthetic demo data generator and loader")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    subparsers.add_parser("generate", help="Generate synthetic environment and daily sample CSVs")
    
    load_parser = subparsers.add_parser("load", help="Load synthetic demo data into SQLite database")
    load_parser.add_argument("--reset", action="store_true", help="Reset existing demo records before loading")
    
    args = parser.parse_args()
    if args.command == "generate":
        generate()
    elif args.command == "load":
        load(reset=args.reset)

if __name__ == '__main__':
    main()
