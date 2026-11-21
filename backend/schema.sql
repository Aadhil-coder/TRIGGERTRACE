-- TriggerTrace Database Schema

CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'self' CHECK(role IN ('self', 'caregiver')),
    district TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    attacked_at TEXT NOT NULL,
    district TEXT NOT NULL,
    severity TEXT CHECK(severity IN ('mild', 'moderate', 'severe') OR severity IS NULL),
    inhaler_used INTEGER CHECK(inhaler_used IN (0, 1) OR inhaler_used IS NULL),
    logged_later INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attacks_profile_time ON attacks(profile_id, attacked_at);

CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    checkin_date TEXT NOT NULL,
    had_symptoms INTEGER NOT NULL CHECK(had_symptoms IN (0, 1)),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(profile_id, checkin_date)
);

CREATE TABLE IF NOT EXISTS environment_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    pm2_5 REAL,
    humidity REAL,
    temperature REAL,
    rainfall REAL,
    source TEXT,
    fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(district, observed_at)
);
