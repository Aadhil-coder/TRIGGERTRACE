import os
import sys
import csv
from pathlib import Path
from datetime import datetime, timedelta
import numpy as np
import pytest

# Add backend and data to sys.path
TEST_DIR = Path(__file__).resolve().parent
BACKEND_DIR = TEST_DIR.parent
DATA_DIR = BACKEND_DIR.parent / 'data'
sys.path.insert(0, str(BACKEND_DIR))

from analysis import (
    make_daily_table,
    aggregate_hourly_to_daily,
    get_verdict,
    run_analysis,
    DISCLAIMER
)

# Test environment settings
MIN_ATTACKS = 10
MIN_CHECKIN_DAYS = 30
BOOTSTRAP_RESAMPLES = 200

# ============================================================================
# Feature Tests
# ============================================================================

def test_empty_input():
    rows = make_daily_table([], {}, {})
    assert rows == []

def test_symptom_free_eligibility():
    attack_dates = []
    checkins = {'2026-08-05': 0}
    env = {'2026-08-04': {'pm2_5': 20.0, 'humidity': 50.0, 'temperature': 25.0, 'rainfall': 0.0},
           '2026-08-05': {'pm2_5': 22.0, 'humidity': 55.0, 'temperature': 26.0, 'rainfall': 0.0}}
    rows = make_daily_table(attack_dates, checkins, env)
    row_05 = next(r for r in rows if r['date'] == '2026-08-05')
    assert row_05['checked_in'] == 1
    assert row_05['attack'] == 0
    assert row_05['symptom_free'] == 1
    assert row_05['eligible'] == 1

def test_symptomatic_checkin_not_eligible():
    attack_dates = []
    checkins = {'2026-08-05': 1}
    env = {'2026-08-04': {'pm2_5': 20.0}, '2026-08-05': {'pm2_5': 22.0}}
    rows = make_daily_table(attack_dates, checkins, env)
    row_05 = next(r for r in rows if r['date'] == '2026-08-05')
    assert row_05['checked_in'] == 1
    assert row_05['symptom_free'] == 0
    assert row_05['eligible'] == 0

def test_no_checkin_never_assumed_symptom_free():
    attack_dates = []
    checkins = {}
    env = {'2026-08-04': {'pm2_5': 20.0}, '2026-08-05': {'pm2_5': 22.0}}
    rows = make_daily_table(attack_dates, checkins, env)
    row_05 = next(r for r in rows if r['date'] == '2026-08-05')
    assert row_05['checked_in'] == 0
    assert row_05['attack'] == 0
    assert row_05['symptom_free'] == 0
    assert row_05['eligible'] == 0

def test_attack_day_eligible_without_checkin():
    attack_dates = ['2026-08-05']
    checkins = {}
    env = {'2026-08-04': {'pm2_5': 20.0}, '2026-08-05': {'pm2_5': 22.0}}
    rows = make_daily_table(attack_dates, checkins, env)
    row_05 = next(r for r in rows if r['date'] == '2026-08-05')
    assert row_05['attack'] == 1
    assert row_05['checked_in'] == 0
    assert row_05['symptom_free'] == 0
    assert row_05['eligible'] == 1

def test_attack_day_not_symptom_free_even_with_no_symptoms_checkin():
    attack_dates = ['2026-08-05']
    checkins = {'2026-08-05': 0}
    env = {'2026-08-04': {'pm2_5': 20.0}, '2026-08-05': {'pm2_5': 22.0}}
    rows = make_daily_table(attack_dates, checkins, env)
    row_05 = next(r for r in rows if r['date'] == '2026-08-05')
    assert row_05['attack'] == 1
    assert row_05['checked_in'] == 1
    assert row_05['symptom_free'] == 0
    assert row_05['eligible'] == 1

def test_lag_uses_previous_day():
    attack_dates = ['2026-08-05']
    checkins = {'2026-08-05': 0}
    env = {'2026-08-04': {'pm2_5': 42.5}, '2026-08-05': {'pm2_5': 18.0}}
    rows = make_daily_table(attack_dates, checkins, env)
    row_05 = next(r for r in rows if r['date'] == '2026-08-05')
    assert row_05['pm25_lag1'] == 42.5

def test_first_day_lag_is_none():
    attack_dates = ['2026-08-05']
    checkins = {}
    env = {'2026-08-05': {'pm2_5': 22.0}}
    rows = make_daily_table(attack_dates, checkins, env)
    first_row = rows[0]
    # Earliest date is 2026-08-04 (min_date - 1 day), its lag needs 2026-08-03 which is None
    assert first_row['pm25_lag1'] is None

def test_rows_cover_every_day_in_range():
    attack_dates = ['2026-08-01', '2026-08-10']
    checkins = {}
    env = {}
    rows = make_daily_table(attack_dates, checkins, env)
    # Range is 2026-07-31 to 2026-08-10 inclusive = 11 days
    assert len(rows) == 11
    dates = [r['date'] for r in rows]
    start = datetime(2026, 7, 31)
    for i, d in enumerate(dates):
        expected = (start + timedelta(days=i)).strftime('%Y-%m-%d')
        assert d == expected

def test_hourly_to_daily_mean_and_rain_sum():
    hourly = [
        {'observed_at': '2026-08-01T00:00', 'pm2_5': 20.0, 'humidity': 60.0, 'temperature': 24.0, 'rainfall': 1.5},
        {'observed_at': '2026-08-01T12:00', 'pm2_5': 40.0, 'humidity': 80.0, 'temperature': 30.0, 'rainfall': 2.5},
    ]
    daily = aggregate_hourly_to_daily(hourly)
    assert '2026-08-01' in daily
    d = daily['2026-08-01']
    assert d['pm2_5'] == 30.0
    assert d['humidity'] == 70.0
    assert d['temperature'] == 27.0
    assert d['rainfall'] == 4.0

# ============================================================================
# Analysis Tests
# ============================================================================

def test_verdict_rules():
    assert get_verdict(1.05, 2.30) == "possible higher risk"
    assert get_verdict(0.40, 0.95) == "possible lower risk"
    assert get_verdict(0.85, 1.45) == "no clear pattern"

def test_too_few_attacks_returns_not_enough_data():
    daily_table = [
        {'date': f'2026-08-{i:02d}', 'attack': 1 if i <= 5 else 0, 'checked_in': 1, 'symptom_free': 0 if i <= 5 else 1, 'eligible': 1,
         'pm25_lag1': 30.0, 'humidity': 60.0, 'temperature': 25.0, 'rainfall': 0.0}
        for i in range(1, 35)
    ]
    res = run_analysis(daily_table=daily_table, min_attacks=MIN_ATTACKS, min_checkin_days=MIN_CHECKIN_DAYS, bootstrap_resamples=BOOTSTRAP_RESAMPLES)
    assert res['status'] == 'not_enough_data'
    assert res['n_attack_days'] == 5
    assert 'Need at least 10 attacks' in res['message']

def test_too_few_checkin_days_returns_not_enough_data():
    daily_table = [
        {'date': f'2026-08-{i:02d}', 'attack': 1 if i <= 12 else 0, 'checked_in': 1 if i <= 20 else 0, 'symptom_free': 1 if 13 <= i <= 20 else 0, 'eligible': 1 if i <= 20 else 0,
         'pm25_lag1': 30.0, 'humidity': 60.0, 'temperature': 25.0, 'rainfall': 0.0}
        for i in range(1, 35)
    ]
    res = run_analysis(daily_table=daily_table, min_attacks=MIN_ATTACKS, min_checkin_days=MIN_CHECKIN_DAYS, bootstrap_resamples=BOOTSTRAP_RESAMPLES)
    assert res['status'] == 'not_enough_data'
    assert res['n_checkin_days'] == 20
    assert '30 check-in days' in res['message']

def test_empty_input_returns_not_enough_data():
    res = run_analysis(daily_table=[], min_attacks=MIN_ATTACKS, min_checkin_days=MIN_CHECKIN_DAYS, bootstrap_resamples=BOOTSTRAP_RESAMPLES)
    assert res['status'] == 'not_enough_data'

def test_planted_pm25_pattern():
    # 300 days, seed 1, effect 0.07 (or slightly higher variance)
    rng = np.random.default_rng(1)
    n_days = 300
    daily_table = []
    yesterday_pm25 = 35.0
    
    for i in range(n_days):
        pm25 = float(rng.normal(40.0, 12.0))
        hum = float(rng.normal(60.0, 10.0))
        temp = float(rng.normal(26.0, 3.0))
        rain = float(rng.exponential(2.0))
        
        logit = -1.2 + 0.07 * (yesterday_pm25 - 35.0)
        prob = 1.0 / (1.0 + np.exp(-logit))
        att = 1 if rng.random() < prob else 0
        chk = 1 if rng.random() < 0.85 else 0
        sym_free = 1 if (chk == 1 and att == 0 and rng.random() > 0.05) else 0
        elig = 1 if (att == 1 or sym_free == 1) else 0
        
        daily_table.append({
            'date': f'2026-{(i//30)+1:02d}-{(i%30)+1:02d}',
            'attack': att,
            'checked_in': chk,
            'symptom_free': sym_free,
            'eligible': elig,
            'pm25_lag1': yesterday_pm25,
            'humidity': hum,
            'temperature': temp,
            'rainfall': rain
        })
        yesterday_pm25 = pm25
        
    res = run_analysis(daily_table=daily_table, min_attacks=10, min_checkin_days=30, bootstrap_resamples=BOOTSTRAP_RESAMPLES)
    assert res['status'] == 'ok'
    pm25_factor = next(f for f in res['factors'] if f['factor'] == 'pm25_lag1')
    assert pm25_factor['verdict'] == 'possible higher risk'
    assert pm25_factor['odds_ratio'] > 1.5

def test_result_structure():
    rng = np.random.default_rng(42)
    daily_table = [
        {'date': f'2026-08-{i:02d}', 'attack': 1 if i <= 15 else 0, 'checked_in': 1, 'symptom_free': 0 if i <= 15 else 1, 'eligible': 1,
         'pm25_lag1': 30.0 + rng.normal(0, 5), 'humidity': 60.0 + rng.normal(0, 10), 'temperature': 25.0 + rng.normal(0, 2), 'rainfall': float(rng.exponential(1.0))}
        for i in range(1, 50)
    ]
    res = run_analysis(daily_table=daily_table, min_attacks=MIN_ATTACKS, min_checkin_days=MIN_CHECKIN_DAYS, bootstrap_resamples=BOOTSTRAP_RESAMPLES)
    assert res['status'] == 'ok'
    for k in ['status', 'n_attack_days', 'n_checkin_days', 'unit', 'confidence_note', 'factors', 'simple_check', 'disclaimer']:
        assert k in res
    for f in res['factors']:
        for fk in ['factor', 'label', 'odds_ratio', 'range_low', 'range_high', 'verdict']:
            assert fk in f

def test_repeatable_results():
    rng = np.random.default_rng(42)
    daily_table = [
        {'date': f'2026-08-{i:02d}', 'attack': 1 if i <= 15 else 0, 'checked_in': 1, 'symptom_free': 0 if i <= 15 else 1, 'eligible': 1,
         'pm25_lag1': 30.0 + rng.normal(0, 5), 'humidity': 60.0 + rng.normal(0, 10), 'temperature': 25.0 + rng.normal(0, 2), 'rainfall': float(rng.exponential(1.0))}
        for i in range(1, 50)
    ]
    res1 = run_analysis(daily_table=daily_table, min_attacks=MIN_ATTACKS, min_checkin_days=MIN_CHECKIN_DAYS, bootstrap_resamples=BOOTSTRAP_RESAMPLES)
    res2 = run_analysis(daily_table=daily_table, min_attacks=MIN_ATTACKS, min_checkin_days=MIN_CHECKIN_DAYS, bootstrap_resamples=BOOTSTRAP_RESAMPLES)
    assert res1['factors'] == res2['factors']

def test_demo_csv_attack_and_checkin_counts():
    csv_path = DATA_DIR / 'synthetic_sample.csv'
    assert csv_path.exists(), f"Missing {csv_path}"
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = list(csv.DictReader(f))
        
    attack_days = sum(int(r['attack']) for r in reader)
    checkin_days = sum(int(r['checked_in']) for r in reader)
    symptom_free_days = sum(1 for r in reader if int(r['checked_in']) == 1 and r['had_symptoms'] == '0' and int(r['attack']) == 0)
    
    assert attack_days == 16
    assert checkin_days == 75
    assert symptom_free_days == 61

def test_demo_csv_pm25_simple_check_rate_ratio():
    csv_path = DATA_DIR / 'synthetic_sample.csv'
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = list(csv.DictReader(f))
        
    attack_dates = {r['date'] for r in reader if int(r['attack']) == 1}
    checkins = {r['date']: int(r['had_symptoms']) for r in reader if int(r['checked_in']) == 1 and r['had_symptoms'] != ''}
    env_daily = {r['date']: {'pm2_5': float(r['pm2_5']), 'humidity': float(r['humidity']), 'temperature': float(r['temperature']), 'rainfall': float(r['rainfall'])} for r in reader}
    
    daily_table = make_daily_table(attack_dates, checkins, env_daily)
    res = run_analysis(daily_table=daily_table, min_attacks=MIN_ATTACKS, min_checkin_days=MIN_CHECKIN_DAYS, bootstrap_resamples=BOOTSTRAP_RESAMPLES)
    
    assert res['status'] == 'ok'
    pm25_sc = res['simple_check']['pm25_lag1']
    assert pm25_sc['rate_ratio'] is not None
    assert pm25_sc['rate_ratio'] > 1.0

def test_confidence_note_small_sample_warning():
    daily_table = [
        {'date': f'2026-08-{i:02d}', 'attack': 1 if i <= 15 else 0, 'checked_in': 1, 'symptom_free': 0 if i <= 15 else 1, 'eligible': 1,
         'pm25_lag1': 30.0, 'humidity': 60.0, 'temperature': 25.0, 'rainfall': 0.0}
        for i in range(1, 50)
    ]
    res = run_analysis(daily_table=daily_table, min_attacks=MIN_ATTACKS, min_checkin_days=MIN_CHECKIN_DAYS, bootstrap_resamples=BOOTSTRAP_RESAMPLES)
    assert res['status'] == 'ok'
    assert 'The sample is still small' in res['confidence_note']
