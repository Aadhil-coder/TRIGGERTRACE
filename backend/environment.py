import os
import json
import sqlite3
from datetime import datetime, timedelta
import requests
from flask import current_app, g

def get_db():
    if 'db' not in g:
        from app import get_db as app_get_db
        return app_get_db()
    return g.db

def get_hourly(district, start_date, end_date, lat=None, lon=None):
    """
    Returns a list of dicts for hourly weather and PM2.5 readings.
    start_date and end_date are string dates 'YYYY-MM-DD'.
    """
    db = get_db()
    cache_dir = current_app.config.get('CACHE_DIR', os.path.join(os.path.dirname(__file__), '..', 'data', 'cache'))
    use_cache_only = int(current_app.config.get('USE_CACHE_ONLY', 0))

    if lat is None:
        lat = current_app.config.get('DEFAULT_LATITUDE')
    if lon is None:
        lon = current_app.config.get('DEFAULT_LONGITUDE')

    start_dt = datetime.strptime(start_date, '%Y-%m-%d')
    end_dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)

    start_iso = start_dt.strftime('%Y-%m-%d 00:00')
    end_iso = (end_dt - timedelta(hours=1)).strftime('%Y-%m-%d 23:00')

    clean_dist = (district or '').strip()
    cur = db.cursor()
    cur.execute(
        """
        SELECT observed_at, pm2_5, humidity, temperature, rainfall
        FROM environment_cache
        WHERE (LOWER(district) = LOWER(?) OR LOWER(district) LIKE LOWER(?) || '%' OR LOWER(?) LIKE LOWER(district) || '%')
          AND observed_at >= ? AND observed_at <= ?
        ORDER BY observed_at ASC
        """,
        (clean_dist, clean_dist, clean_dist, start_iso[:10], end_iso[:10] + 'T23:59:59')
    )
    rows = cur.fetchall()

    cache_map = {}
    for r in rows:
        cache_map[r['observed_at']] = {
            'observed_at': r['observed_at'],
            'pm2_5': r['pm2_5'],
            'humidity': r['humidity'],
            'temperature': r['temperature'],
            'rainfall': r['rainfall']
        }

    total_expected_hours = int((end_dt - start_dt).total_seconds() // 3600)
    expected_times = [
        (start_dt + timedelta(hours=i)).strftime('%Y-%m-%dT%H:00')
        for i in range(total_expected_hours)
    ]

    missing = [t for t in expected_times if t not in cache_map and t.replace('T', ' ') not in cache_map]
    is_synthetic = 'synthetic' in (district or '').lower()

    if missing and not is_synthetic and use_cache_only != 1 and lat is not None and lon is not None:
        try:
            os.makedirs(cache_dir, exist_ok=True)
            weather_url = 'https://archive-api.open-meteo.com/v1/archive'
            weather_params = {
                'latitude': lat,
                'longitude': lon,
                'start_date': start_date,
                'end_date': end_date,
                'hourly': 'temperature_2m,relative_humidity_2m,rain',
                'timezone': 'auto'
            }
            w_res = requests.get(weather_url, params=weather_params, timeout=10)
            w_data = w_res.json() if w_res.ok else None

            air_url = 'https://air-quality-api.open-meteo.com/v1/air-quality'
            air_params = {
                'latitude': lat,
                'longitude': lon,
                'start_date': start_date,
                'end_date': end_date,
                'hourly': 'pm2_5',
                'timezone': 'auto'
            }
            a_res = requests.get(air_url, params=air_params, timeout=10)
            a_data = a_res.json() if a_res.ok else None

            if w_data and 'hourly' in w_data:
                cache_file = os.path.join(cache_dir, f"{district}_{start_date}_{end_date}_weather.json")
                with open(cache_file, 'w', encoding='utf-8') as f:
                    json.dump(w_data, f)
            if a_data and 'hourly' in a_data:
                cache_file = os.path.join(cache_dir, f"{district}_{start_date}_{end_date}_air.json")
                with open(cache_file, 'w', encoding='utf-8') as f:
                    json.dump(a_data, f)

            if w_data and 'hourly' in w_data:
                wh = w_data['hourly']
                ah = a_data.get('hourly', {}) if a_data else {}
                times = wh.get('time', [])
                temps = wh.get('temperature_2m', [])
                hums = wh.get('relative_humidity_2m', [])
                rains = wh.get('rain', [])
                pm_times = ah.get('time', [])
                pms = ah.get('pm2_5', [])
                pm_dict = dict(zip(pm_times, pms))

                for idx, t in enumerate(times):
                    obs_at = t
                    pm_val = pm_dict.get(t)
                    temp_val = temps[idx] if idx < len(temps) else None
                    hum_val = hums[idx] if idx < len(hums) else None
                    rain_val = rains[idx] if idx < len(rains) else None

                    cur.execute(
                        """
                        INSERT OR REPLACE INTO environment_cache
                        (district, observed_at, pm2_5, humidity, temperature, rainfall, source, fetched_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'open-meteo', CURRENT_TIMESTAMP)
                        """,
                        (district, obs_at, pm_val, hum_val, temp_val, rain_val)
                    )
                    cache_map[obs_at] = {
                        'observed_at': obs_at,
                        'pm2_5': pm_val,
                        'humidity': hum_val,
                        'temperature': temp_val,
                        'rainfall': rain_val
                    }
                db.commit()
        except Exception as e:
            print(f"[environment] Open-Meteo fetch failed: {e}")

    result = []
    for t in expected_times:
        if t in cache_map:
            result.append(cache_map[t])
        elif t.replace('T', ' ') in cache_map:
            result.append(cache_map[t.replace('T', ' ')])
    return result
