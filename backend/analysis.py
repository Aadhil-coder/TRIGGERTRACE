import os
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from flask import current_app, g

DISCLAIMER = (
    "These are possible patterns, not causes and not a diagnosis. "
    "Discuss them with your doctor. During a severe attack, follow "
    "your asthma action plan or call emergency services first."
)

FACTOR_LABELS = {
    "pm25_lag1": "PM2.5 the day before",
    "humidity": "Humidity that day",
    "temperature": "Temperature that day",
    "rainfall": "Rainfall that day"
}

def get_db():
    if 'db' not in g:
        from app import get_db as app_get_db
        return app_get_db()
    return g.db

def aggregate_hourly_to_daily(hourly_rows):
    """
    Groups hourly rows by date (YYYY-MM-DD) and returns:
    dict: { 'YYYY-MM-DD': { 'pm2_5': mean, 'humidity': mean, 'temperature': mean, 'rainfall': sum } }
    """
    by_date = {}
    for r in hourly_rows:
        obs = r.get('observed_at', '')
        if not obs:
            continue
        dt_str = obs[:10]
        if dt_str not in by_date:
            by_date[dt_str] = {'pm2_5': [], 'humidity': [], 'temperature': [], 'rainfall': []}
        if r.get('pm2_5') is not None:
            by_date[dt_str]['pm2_5'].append(float(r['pm2_5']))
        if r.get('humidity') is not None:
            by_date[dt_str]['humidity'].append(float(r['humidity']))
        if r.get('temperature') is not None:
            by_date[dt_str]['temperature'].append(float(r['temperature']))
        if r.get('rainfall') is not None:
            by_date[dt_str]['rainfall'].append(float(r['rainfall']))

    daily = {}
    for d, vals in by_date.items():
        daily[d] = {
            'pm2_5': float(np.mean(vals['pm2_5'])) if vals['pm2_5'] else None,
            'humidity': float(np.mean(vals['humidity'])) if vals['humidity'] else None,
            'temperature': float(np.mean(vals['temperature'])) if vals['temperature'] else None,
            'rainfall': float(np.sum(vals['rainfall'])) if vals['rainfall'] else 0.0
        }
    return daily

def make_daily_table(attack_dates, checkins, env_daily):
    """
    Pure function to construct the daily table.
    - attack_dates: set or list of 'YYYY-MM-DD' strings
    - checkins: dict { 'YYYY-MM-DD': had_symptoms (0 or 1) }
    - env_daily: dict { 'YYYY-MM-DD': { 'pm2_5': val, 'humidity': val, 'temperature': val, 'rainfall': val } }
    """
    all_dates = set()
    for d in attack_dates:
        all_dates.add(d)
    for d in checkins.keys():
        all_dates.add(d)
    for d in env_daily.keys():
        all_dates.add(d)

    if not all_dates:
        return []

    min_date = min(all_dates)
    max_date = max(all_dates)

    start_dt = datetime.strptime(min_date, '%Y-%m-%d') - timedelta(days=1)
    end_dt = datetime.strptime(max_date, '%Y-%m-%d')

    attack_set = set(attack_dates)
    rows = []

    curr = start_dt
    while curr <= end_dt:
        d_str = curr.strftime('%Y-%m-%d')
        prev_str = (curr - timedelta(days=1)).strftime('%Y-%m-%d')

        has_attack = 1 if d_str in attack_set else 0
        is_checked_in = 1 if d_str in checkins else 0
        symptom_val = checkins.get(d_str)

        is_symptom_free = 1 if (is_checked_in == 1 and symptom_val == 0 and has_attack == 0) else 0
        is_eligible = 1 if (has_attack == 1 or is_symptom_free == 1) else 0

        prev_env = env_daily.get(prev_str, {})
        curr_env = env_daily.get(d_str, {})

        pm25_lag1 = prev_env.get('pm2_5')
        humidity = curr_env.get('humidity')
        temperature = curr_env.get('temperature')
        rainfall = curr_env.get('rainfall')

        rows.append({
            'date': d_str,
            'attack': has_attack,
            'checked_in': is_checked_in,
            'symptom_free': is_symptom_free,
            'eligible': is_eligible,
            'pm25_lag1': pm25_lag1,
            'humidity': humidity,
            'temperature': temperature,
            'rainfall': rainfall
        })
        curr += timedelta(days=1)

    return rows

def build_daily_table(profile_id):
    db = get_db()
    cur = db.cursor()

    cur.execute("SELECT district FROM profiles WHERE id = ?", (profile_id,))
    prof = cur.fetchone()
    district = prof['district'] if prof and prof['district'] else current_app.config.get('DEFAULT_DISTRICT')

    cur.execute("SELECT attacked_at FROM attacks WHERE profile_id = ?", (profile_id,))
    attack_rows = cur.fetchall()
    attack_dates = {r['attacked_at'][:10] for r in attack_rows if r['attacked_at']}

    cur.execute("SELECT checkin_date, had_symptoms FROM checkins WHERE profile_id = ?", (profile_id,))
    checkin_rows = cur.fetchall()
    checkins = {r['checkin_date']: r['had_symptoms'] for r in checkin_rows}

    all_dates = set(attack_dates) | set(checkins.keys())
    if not all_dates:
        return []

    min_date = min(all_dates)
    max_date = max(all_dates)
    start_date = (datetime.strptime(min_date, '%Y-%m-%d') - timedelta(days=1)).strftime('%Y-%m-%d')

    from environment import get_hourly
    hourly = get_hourly(district, start_date, max_date)
    env_daily = aggregate_hourly_to_daily(hourly)

    return make_daily_table(attack_dates, checkins, env_daily)

def get_verdict(range_low, range_high):
    if range_low > 1.0:
        return "possible higher risk"
    elif range_high < 1.0:
        return "possible lower risk"
    return "no clear pattern"

def compute_simple_check(eligible_rows, factor):
    vals = [r[factor] for r in eligible_rows if r.get(factor) is not None]
    if not vals:
        return {"high_rate": 0, "low_rate": 0, "rate_ratio": None}
    median = float(np.median(vals))

    high_attacks = sum(1 for r in eligible_rows if r.get(factor) is not None and r[factor] > median and r['attack'] == 1)
    high_total = sum(1 for r in eligible_rows if r.get(factor) is not None and r[factor] > median)
    high_rate = high_attacks / high_total if high_total > 0 else 0.0

    low_attacks = sum(1 for r in eligible_rows if r.get(factor) is not None and r[factor] <= median and r['attack'] == 1)
    low_total = sum(1 for r in eligible_rows if r.get(factor) is not None and r[factor] <= median)
    low_rate = low_attacks / low_total if low_total > 0 else 0.0

    rate_ratio = round(high_rate / low_rate, 2) if low_rate > 0 else None

    return {
        "high_rate": int(round(high_rate * 100)),
        "low_rate": int(round(low_rate * 100)),
        "rate_ratio": rate_ratio
    }

def run_analysis(profile_id=None, daily_table=None, min_attacks=None, min_checkin_days=None, bootstrap_resamples=None):
    if min_attacks is None:
        min_attacks = current_app.config.get('MIN_ATTACKS', 10) if current_app else 10
    if min_checkin_days is None:
        min_checkin_days = current_app.config.get('MIN_CHECKIN_DAYS', 30) if current_app else 30
    if bootstrap_resamples is None:
        bootstrap_resamples = current_app.config.get('BOOTSTRAP_RESAMPLES', 500) if current_app else 500

    if daily_table is None:
        if profile_id is None:
            return {
                "status": "not_enough_data",
                "n_attack_days": 0,
                "n_checkin_days": 0,
                "message": f"Need at least {min_attacks} attacks and {min_checkin_days} check-in days before showing patterns. Keep logging.",
                "factors": [],
                "disclaimer": DISCLAIMER
            }
        daily_table = build_daily_table(profile_id)

    if not daily_table:
        return {
            "status": "not_enough_data",
            "n_attack_days": 0,
            "n_checkin_days": 0,
            "message": f"Need at least {min_attacks} attacks and {min_checkin_days} check-in days before showing patterns. Keep logging.",
            "factors": [],
            "disclaimer": DISCLAIMER
        }

    n_attack_days = sum(1 for r in daily_table if r['attack'] == 1)
    n_checkin_days = sum(1 for r in daily_table if r['checked_in'] == 1)

    if n_attack_days < min_attacks or n_checkin_days < min_checkin_days:
        return {
            "status": "not_enough_data",
            "n_attack_days": int(n_attack_days),
            "n_checkin_days": int(n_checkin_days),
            "message": f"Need at least {min_attacks} attacks and {min_checkin_days} check-in days before showing patterns. Keep logging.",
            "factors": [],
            "disclaimer": DISCLAIMER
        }

    feature_keys = ["pm25_lag1", "humidity", "temperature", "rainfall"]
    eligible_complete = []
    for r in daily_table:
        if r['eligible'] == 1:
            if all(r.get(k) is not None and not np.isnan(float(r[k])) for k in feature_keys):
                eligible_complete.append(r)

    y = np.array([r['attack'] for r in eligible_complete], dtype=int)
    if len(eligible_complete) < 20 or len(np.unique(y)) < 2:
        return {
            "status": "not_enough_data",
            "n_attack_days": int(n_attack_days),
            "n_checkin_days": int(n_checkin_days),
            "message": f"Need at least 20 eligible days with both outcomes to analyze patterns. Keep logging.",
            "factors": [],
            "disclaimer": DISCLAIMER
        }

    X = np.array([[float(r[k]) for k in feature_keys] for r in eligible_complete], dtype=float)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    clf = LogisticRegression(C=1.0, max_iter=1000)
    clf.fit(X_scaled, y)
    base_ors = np.exp(clf.coef_[0])

    rng = np.random.default_rng(42)
    n_samples = len(y)
    boot_ors = []

    for _ in range(bootstrap_resamples):
        indices = rng.choice(n_samples, size=n_samples, replace=True)
        y_b = y[indices]
        if len(np.unique(y_b)) < 2:
            continue
        X_b = X[indices]
        scaler_b = StandardScaler()
        X_b_scaled = scaler_b.fit_transform(X_b)
        clf_b = LogisticRegression(C=1.0, max_iter=1000)
        clf_b.fit(X_b_scaled, y_b)
        boot_ors.append(np.exp(clf_b.coef_[0]))

    if len(boot_ors) < 50:
        return {
            "status": "not_enough_data",
            "n_attack_days": int(n_attack_days),
            "n_checkin_days": int(n_checkin_days),
            "message": f"Uncertainty calculation requires more data. Keep logging.",
            "factors": [],
            "disclaimer": DISCLAIMER
        }

    boot_ors = np.array(boot_ors)
    factors = []
    for i, factor in enumerate(feature_keys):
        or_val = round(float(base_ors[i]), 2)
        low_val = round(float(np.percentile(boot_ors[:, i], 2.5)), 2)
        high_val = round(float(np.percentile(boot_ors[:, i], 97.5)), 2)
        verdict = get_verdict(low_val, high_val)
        factors.append({
            "factor": factor,
            "label": FACTOR_LABELS[factor],
            "odds_ratio": or_val,
            "range_low": low_val,
            "range_high": high_val,
            "verdict": verdict
        })

    simple_check = {
        "pm25_lag1": compute_simple_check(eligible_complete, "pm25_lag1"),
        "humidity": compute_simple_check(eligible_complete, "humidity")
    }

    confidence_note = f"Based on {n_attack_days} attack days and {n_checkin_days} check-in days. This is a possible pattern, not a cause."
    if n_attack_days < 20:
        confidence_note += " The sample is still small, so treat this as a hint to discuss with your doctor."

    return {
        "status": "ok",
        "n_attack_days": int(n_attack_days),
        "n_checkin_days": int(n_checkin_days),
        "unit": "odds ratio per 1 standard deviation increase in each factor",
        "confidence_note": confidence_note,
        "factors": factors,
        "simple_check": simple_check,
        "disclaimer": DISCLAIMER
    }
