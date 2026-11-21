import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  Pill,
  ChoiceCard,
  RingProgress,
  RangeBar,
  DayStrip,
  DocThumbnail,
  ConfirmDialog,
  EmergencyBanner,
  SyncBanner,
  Icon
} from './components';
import {
  api,
  logAttack,
  saveFollowUp,
  saveCheckin,
  flushQueue,
  pendingCount,
  setSafetyAcked
} from './api';

// Format helper
function formatDateTime(isoString) {
  if (!isoString) return '';
  const dt = new Date(isoString);
  if (isNaN(dt.getTime())) return isoString;
  const day = dt.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[dt.getMonth()];
  const hours = String(dt.getHours()).padStart(2, '0');
  const mins = String(dt.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hours}:${mins}`;
}

// Local calendar date helper (prevents UTC timezone shift bug)
export function toLocalDateString(d = new Date()) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// 01 Safety Notice
// ============================================================================
export function Screen01Safety({ onAcknowledge }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', padding: '16px 0' }}>
      <Card style={{ borderTop: '4px solid #B91C1C', padding: '24px 20px' }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          backgroundColor: '#FEF2F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          color: '#B91C1C'
        }}>
          <Icon name="shield" size={28} />
        </div>

        <h1 className="screen-title" style={{ fontSize: 22, marginBottom: 16 }}>
          Before you start
        </h1>

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ color: '#178578', marginTop: 2 }}><Icon name="check" size={18} /></span>
            <span style={{ fontSize: 13, color: '#102A38', fontWeight: 500 }}>Finds possible patterns, not a diagnosis.</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ color: '#178578', marginTop: 2 }}><Icon name="check" size={18} /></span>
            <span style={{ fontSize: 13, color: '#102A38', fontWeight: 500 }}>No treatment advice. Discuss results with your doctor.</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ color: '#178578', marginTop: 2 }}><Icon name="check" size={18} /></span>
            <span style={{ fontSize: 13, color: '#102A38', fontWeight: 500 }}>Demo uses synthetic data only.</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ color: '#178578', marginTop: 2 }}><Icon name="check" size={18} /></span>
            <span style={{ fontSize: 13, color: '#102A38', fontWeight: 500 }}>Only your district is stored.</span>
          </li>
        </ul>

        <div style={{
          color: '#B91C1C',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.45,
          marginBottom: 24,
          padding: '8px 0'
        }}>
          During a severe attack, follow your asthma action plan or call emergency services first.
        </div>

        <Button
          variant="ink"
          fullWidth
          onClick={() => {
            setSafetyAcked(true);
            onAcknowledge?.();
          }}
        >
          I understand
        </Button>
      </Card>
    </div>
  );
}

// ============================================================================
// 02 & 06 Home & Offline Queue
// ============================================================================
export function Screen02Home({
  profile,
  attacks = [],
  onAttackLogged,
  onNavigate
}) {
  const [loading, setLoading] = useState(false);
  const isOffline = !navigator.onLine;
  const unsyncedCount = pendingCount();

  const handleAttackNow = async () => {
    setLoading(true);
    try {
      const res = await logAttack({
        profileId: profile.id,
        district: profile.district || 'Coimbatore',
        live: true
      });
      onAttackLogged(res);
    } catch (err) {
      alert(`Could not log attack: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SyncBanner count={unsyncedCount} onUploadClick={flushQueue} />

      {/* Hero "Attack now" Button with concentric rings */}
      <div className="hero-attack-container">
        <div className="pulse-rings-wrapper">
          <div className="pulse-ring-outer" />
          <div className="pulse-ring-middle" />
          <button
            className="attack-now-btn"
            onClick={handleAttackNow}
            disabled={loading}
            aria-label="Attack now. Tap once. Details can wait."
          >
            <Icon name="pulse" size={32} />
            <span className="attack-now-text">Attack now</span>
          </button>
        </div>
        <span className="hero-subtext">Tap once. Details can wait.</span>
      </div>

      {/* Two action cards: Past attack & Check-in */}
      <div className="quick-actions-row">
        <div className="action-card" onClick={() => onNavigate('add-past')}>
          <div style={{ color: '#178578' }}><Icon name="clock" size={24} /></div>
          <span>Past attack</span>
        </div>
        <div className="action-card" onClick={() => onNavigate('checkin')}>
          <div style={{ color: '#178578' }}><Icon name="check-circle" size={24} /></div>
          <span>Check-in</span>
        </div>
      </div>

      {/* Recent attacks card */}
      <Card>
        <h2 className="card-title">Recent attacks</h2>
        {attacks.length === 0 ? (
          <p className="body-text" style={{ fontStyle: 'italic' }}>No attacks logged yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {attacks.slice(0, 3).map((att) => (
              <div
                key={att.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid #F1F5F9'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#102A38' }}>
                    {formatDateTime(att.attacked_at)}
                  </div>
                  <div style={{ fontSize: 12, color: '#526773' }}>
                    Severity: {att.severity ? att.severity.charAt(0).toUpperCase() + att.severity.slice(1) : 'Not specified'}
                  </div>
                </div>
                <div>
                  {att.queued ? (
                    <Pill variant="grey">waiting</Pill>
                  ) : att.logged_later ? (
                    <Pill variant="amber">logged later</Pill>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// 03 Follow-up
// ============================================================================
export function Screen03FollowUp({ attack, onFinished }) {
  const [severity, setSeverity] = useState('moderate');
  const [inhalerUsed, setInhalerUsed] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      if (attack && attack.id) {
        await saveFollowUp(attack.id, {
          severity,
          inhaler_used: inhalerUsed
        });
      }
      onFinished();
    } catch (err) {
      alert(`Could not save follow-up: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 className="screen-title" style={{ marginBottom: 4 }}>
          How was the attack?
        </h1>
        <p className="body-text">Answer when you feel calm. This can wait.</p>
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#102A38' }}>Severity</label>
        <div className="choice-card-grid">
          <ChoiceCard
            selected={severity === 'mild'}
            onClick={() => setSeverity('mild')}
            title="Mild"
          >
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#178578' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#CBD5E1' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#CBD5E1' }} />
            </div>
          </ChoiceCard>

          <ChoiceCard
            selected={severity === 'moderate'}
            onClick={() => setSeverity('moderate')}
            title="Moderate"
          >
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#178578' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#178578' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#CBD5E1' }} />
            </div>
          </ChoiceCard>

          <ChoiceCard
            selected={severity === 'severe'}
            onClick={() => setSeverity('severe')}
            title="Severe"
          >
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#178578' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#178578' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#178578' }} />
            </div>
          </ChoiceCard>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#102A38' }}>Did you use your inhaler?</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
          <ChoiceCard
            selected={inhalerUsed === true}
            onClick={() => setInhalerUsed(true)}
            title="Yes"
            icon={<Icon name="check" size={18} color="#178578" />}
          />
          <ChoiceCard
            selected={inhalerUsed === false}
            onClick={() => setInhalerUsed(false)}
            title="No"
          />
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button variant="primary" fullWidth onClick={handleSave} disabled={submitting}>
          Save
        </Button>
        <Button variant="ghost" fullWidth onClick={onFinished}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 04 Add Past Attack
// ============================================================================
export function Screen04AddPast({ profile, onSaved, onCancel }) {
  const [attackedAt, setAttackedAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - 30);
    return d.toISOString().slice(0, 16);
  });
  const [severity, setSeverity] = useState('moderate');
  const [inhalerUsed, setInhalerUsed] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const applyRelativeChip = (minutesAgo) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - minutesAgo);
    setAttackedAt(d.toISOString().slice(0, 16));
    setError('');
  };

  const applyLastNight = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(22, 0, 0, 0);
    setAttackedAt(d.toISOString().slice(0, 16));
    setError('');
  };

  const handleSave = async () => {
    setError('');
    const chosen = new Date(attackedAt);
    if (isNaN(chosen.getTime())) {
      setError('Please select a valid date and time.');
      return;
    }
    if (chosen > new Date()) {
      setError('Cannot log an attack in the future.');
      return;
    }

    setSubmitting(true);
    try {
      const att = await logAttack({
        profileId: profile.id,
        district: profile.district || 'Coimbatore',
        attacked_at: attackedAt + ':00',
        live: false
      });
      if (att && att.id) {
        await saveFollowUp(att.id, {
          severity,
          inhaler_used: inhalerUsed
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save past attack.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="screen-title" style={{ marginBottom: 0 }}>Log a past attack</h1>
        <Pill variant="amber">Marked as logged later</Pill>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', backgroundColor: '#FEF2F2', color: '#B91C1C', borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Quick Chips */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#526773' }}>Quick pick:</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button
            type="button"
            className="tt-pill pill-grey"
            style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}
            onClick={() => applyRelativeChip(30)}
          >
            30 mins ago
          </button>
          <button
            type="button"
            className="tt-pill pill-grey"
            style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}
            onClick={() => applyRelativeChip(120)}
          >
            2 hrs ago
          </button>
          <button
            type="button"
            className="tt-pill pill-grey"
            style={{ cursor: 'pointer', border: 'none', padding: '6px 12px' }}
            onClick={applyLastNight}
          >
            Last night
          </button>
        </div>
      </div>

      {/* Date & Time Picker */}
      <Card style={{ padding: '14px 16px' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#102A38', display: 'block', marginBottom: 6 }}>
          Date & Time
        </label>
        <input
          type="datetime-local"
          value={attackedAt}
          onChange={(e) => {
            setAttackedAt(e.target.value);
            setError('');
          }}
          max={new Date().toISOString().slice(0, 16)}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #CBD5E1',
            borderRadius: 10,
            fontSize: 14,
            fontFamily: 'inherit',
            color: '#102A38'
          }}
        />
      </Card>

      {/* Severity Selector */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#102A38' }}>Severity</label>
        <div className="choice-card-grid">
          <ChoiceCard selected={severity === 'mild'} onClick={() => setSeverity('mild')} title="Mild" />
          <ChoiceCard selected={severity === 'moderate'} onClick={() => setSeverity('moderate')} title="Moderate" />
          <ChoiceCard selected={severity === 'severe'} onClick={() => setSeverity('severe')} title="Severe" />
        </div>
      </div>

      {/* Inhaler Selector */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#102A38' }}>Did you use your inhaler?</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
          <ChoiceCard selected={inhalerUsed === true} onClick={() => setInhalerUsed(true)} title="Yes" />
          <ChoiceCard selected={inhalerUsed === false} onClick={() => setInhalerUsed(false)} title="No" />
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button variant="primary" fullWidth onClick={handleSave} disabled={submitting}>
          Save past attack
        </Button>
        <Button variant="ghost" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 05 Check-in
// ============================================================================
export function Screen05CheckIn({ profile, checkins = [], onSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const todayStr = toLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Record for currently selected date
  const activeRecord = checkins.find(c => c.checkin_date === selectedDate);
  const isSelectedSymptomFree = activeRecord ? activeRecord.had_symptoms === 0 : false;
  const isSelectedSymptoms = activeRecord ? activeRecord.had_symptoms === 1 : false;

  const handleSelect = async (hadSymptoms) => {
    setSubmitting(true);
    try {
      await saveCheckin({
        profile_id: profile.id,
        checkin_date: selectedDate,
        had_symptoms: hadSymptoms
      });
      onSaved();
    } catch (err) {
      alert(`Could not save check-in: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Generate 7-day strip data using local calendar dates
  const stripDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = toLocalDateString(d);
    const record = checkins.find(c => c.checkin_date === dStr);
    let status = 'unanswered';
    if (record) {
      status = record.had_symptoms === 1 ? 'symptoms' : 'symptom-free';
    }
    stripDays.push({
      dayNum: d.getDate(),
      dateStr: dStr,
      status
    });
  }

  // Format active date label
  const isToday = selectedDate === todayStr;
  const activeDateObj = new Date(selectedDate + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${activeDateObj.getDate()} ${months[activeDateObj.getMonth()]}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 className="screen-title" style={{ marginBottom: 0 }}>
          {isToday ? "Today's check-in" : `Check-in for ${formattedDate}`}
        </h1>
        {!isToday && (
          <button
            type="button"
            className="tt-pill pill-teal"
            style={{ cursor: 'pointer', border: 'none' }}
            onClick={() => setSelectedDate(todayStr)}
          >
            Jump to Today
          </button>
        )}
      </div>

      <p className="body-text" style={{ marginBottom: 16 }}>
        {isToday
          ? "A day you do not answer is never counted as symptom-free."
          : `Editing status for ${formattedDate}. Tap a status below to update.`}
      </p>

      {/* Two large choice cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <ChoiceCard
          selected={isSelectedSymptomFree}
          onClick={() => handleSelect(false)}
          className="choice-card"
          style={{ minHeight: 80, alignItems: 'flex-start', padding: '16px 20px', flexDirection: 'row', gap: 14 }}
        >
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            backgroundColor: '#E3F3F1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#178578',
            flexShrink: 0
          }}>
            <Icon name="check" size={22} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#102A38' }}>Symptom-free</div>
            <div style={{ fontSize: 12, color: '#526773' }}>
              {isToday ? "No symptoms today" : `No symptoms on ${formattedDate}`}
            </div>
          </div>
        </ChoiceCard>

        <ChoiceCard
          selected={isSelectedSymptoms}
          onClick={() => handleSelect(true)}
          className="choice-card"
          style={{ minHeight: 80, alignItems: 'flex-start', padding: '16px 20px', flexDirection: 'row', gap: 14 }}
        >
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            backgroundColor: '#FDEDE8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#E76F51',
            flexShrink: 0
          }}>
            <Icon name="alert" size={22} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#102A38' }}>Yes, symptoms</div>
            <div style={{ fontSize: 12, color: '#526773' }}>
              {isToday ? "Log what you felt" : `Had symptoms on ${formattedDate}`}
            </div>
          </div>
        </ChoiceCard>
      </div>

      {/* 7-day strip (Tap any day to edit) */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Last 7 days</h2>
          <span style={{ fontSize: 11, color: '#526773', fontWeight: 500 }}>Tap day to edit</span>
        </div>
        <DayStrip
          days={stripDays}
          selectedDate={selectedDate}
          onSelectDate={(dStr) => setSelectedDate(dStr)}
        />
      </Card>

      {/* Last 3 days history list */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 className="card-title" style={{ margin: 0 }}>Recent history</h2>
          <span style={{ fontSize: 11, color: '#526773', fontWeight: 500 }}>Last 3 days • Tap to edit</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...stripDays].reverse().slice(0, 3).map((item, idx) => {
            const dt = new Date(item.dateStr + 'T00:00:00');
            const label = `${dt.getDate()} ${months[dt.getMonth()]}${item.dateStr === todayStr ? ' (Today)' : ''}`;
            const isRowSelected = item.dateStr === selectedDate;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(item.dateStr)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  backgroundColor: isRowSelected ? '#E3F3F1' : 'transparent',
                  border: isRowSelected ? '1px solid #178578' : '1px solid transparent',
                  transition: 'background 0.15s ease'
                }}
              >
                <span style={{ fontWeight: isRowSelected ? 700 : 600, fontSize: 13, color: '#102A38' }}>
                  {label}
                </span>
                <div>
                  {item.status === 'symptom-free' ? (
                    <Pill variant="teal">Symptom-free</Pill>
                  ) : item.status === 'symptoms' ? (
                    <Pill variant="coral">Symptoms</Pill>
                  ) : (
                    <Pill variant="grey">Not answered</Pill>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// 07 & 08 Patterns (Ok / Not Enough Data)
// ============================================================================
export function Screen07Patterns({ profile }) {
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    api.getPatterns(profile.id)
      .then((data) => {
        if (mounted) {
          setPatterns(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to load patterns.');
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [profile.id]);

  if (loading) {
    return (
      <div>
        <h1 className="screen-title">Possible patterns</h1>
        <Card style={{ padding: '36px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '3px solid #E2E8F0',
            borderTopColor: '#178578',
            animation: 'spin 0.8s linear infinite'
          }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#102A38', marginBottom: 4 }}>
              Analyzing your environmental patterns...
            </div>
            <p className="body-text" style={{ fontSize: 13, color: '#526773' }}>
              Correlating PM2.5, humidity, temperature, and rainfall
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card style={{ borderLeft: '4px solid #B91C1C' }}>
        <h2 className="card-title">Patterns unavailable</h2>
        <p className="body-text">{error}</p>
      </Card>
    );
  }

  // Screen 08: Not enough data
  if (!patterns || patterns.status === 'not_enough_data') {
    const nAttacks = patterns?.n_attack_days || 0;
    const nCheckins = patterns?.n_checkin_days || 0;

    return (
      <div>
        <h1 className="screen-title">Possible patterns</h1>

        <Card style={{ padding: '24px 20px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#102A38', marginBottom: 6 }}>
            Almost there
          </h2>
          <p className="body-text" style={{ marginBottom: 24 }}>
            Patterns appear after 10 attacks and 30 check-in days. Keep logging.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 20 }}>
            <RingProgress value={nAttacks} max={10} label="Attacks" color="#B91C1C" />
            <RingProgress value={nCheckins} max={30} label="Check-in days" color="#178578" />
          </div>
        </Card>

        {/* Disclaimer card */}
        <Card style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: '#B45309', marginTop: 2 }}><Icon name="alert" size={18} /></span>
            <div style={{ fontSize: 12, color: '#B45309', lineHeight: 1.45 }}>
              Not causes or a diagnosis. Discuss with your doctor.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Screen 07: Enough data
  const { n_attack_days, n_checkin_days, confidence_note, factors = [], simple_check = {}, disclaimer } = patterns;

  return (
    <div>
      <h1 className="screen-title">Possible patterns</h1>

      {/* Summary Banner */}
      <Card style={{ backgroundColor: '#E3F3F1', borderColor: '#CCECE7', padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: '#178578', marginTop: 2 }}><Icon name="patterns" size={20} /></span>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#102A38', lineHeight: 1.45 }}>
            {confidence_note}
          </div>
        </div>
      </Card>

      {/* Factor cards */}
      {factors.map((f) => {
        let pillVariant = 'grey';
        if (f.verdict === 'possible higher risk') pillVariant = 'crimson';
        else if (f.verdict === 'possible lower risk') pillVariant = 'teal';

        const isSmallSampleOrHighOr = (f.odds_ratio && f.odds_ratio > 5) || (n_attack_days && n_attack_days < 20);

        let factorIcon = 'pm25';
        if (f.factor === 'humidity') factorIcon = 'humidity';
        else if (f.factor === 'temperature') factorIcon = 'temperature';
        else if (f.factor === 'rainfall') factorIcon = 'rainfall';

        return (
          <Card key={f.factor} style={{ padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#178578' }}>
                  <Icon name={factorIcon} size={18} />
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#102A38' }}>{f.label}</span>
              </div>
              <Pill variant={pillVariant}>{f.verdict}</Pill>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: '#102A38' }}>
              Odds ratio {f.odds_ratio} per SD
            </div>
            <div style={{ fontSize: 11, color: '#526773', marginBottom: 6 }}>
              Range {f.range_low} to {f.range_high}
            </div>

            <RangeBar
              oddsRatio={f.odds_ratio}
              rangeLow={f.range_low}
              rangeHigh={f.range_high}
              verdict={f.verdict}
            />

            {isSmallSampleOrHighOr && (
              <div style={{
                marginTop: 10,
                padding: '8px 10px',
                backgroundColor: '#FFFBEB',
                borderRadius: 8,
                border: '1px solid #FDE68A',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                color: '#B45309',
                lineHeight: 1.4
              }}>
                <Icon name="alert" size={14} color="#B45309" />
                <span>
                  {f.odds_ratio > 5
                    ? `Caution: Odds ratio (${f.odds_ratio}) is above 5 with wide uncertainty.`
                    : `Caution: Sample has fewer than 20 attacks (${n_attack_days}). Treat this as an exploratory hint.`}
                </span>
              </div>
            )}
          </Card>
        );
      })}

      {/* Simple check card */}
      {simple_check && simple_check.pm25_lag1 && (
        <Card style={{ padding: '16px 18px', marginBottom: 14 }}>
          <h2 className="card-title" style={{ marginBottom: 4 }}>Simple check</h2>
          <p style={{ fontSize: 12, color: '#526773', marginBottom: 12 }}>
            Attacks after high-PM2.5 days
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#102A38' }}>
            <span>high {simple_check.pm25_lag1.high_rate}% • low {simple_check.pm25_lag1.low_rate}%</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 140 }}>
              <div style={{ width: `${Math.min(100, simple_check.pm25_lag1.high_rate * 2)}%`, height: 8, backgroundColor: '#B91C1C', borderRadius: 4 }} />
              <div style={{ width: `${Math.min(100, simple_check.pm25_lag1.low_rate * 2)}%`, height: 8, backgroundColor: '#178578', borderRadius: 4 }} />
            </div>
          </div>
        </Card>
      )}

      {/* Disclaimer card */}
      <Card style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: '#B45309', marginTop: 2 }}><Icon name="alert" size={18} /></span>
          <div style={{ fontSize: 12, color: '#B45309', lineHeight: 1.45 }}>
            {disclaimer}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// 09 Doctor Summary
// ============================================================================
export function Screen09DoctorSummary({ profile, attacks = [], isOnline = true }) {
  const [downloading, setDownloading] = useState(false);
  const [patternsReady, setPatternsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getPatterns(profile.id)
      .then(res => {
        if (mounted && res && res.status === 'ok') {
          setPatternsReady(true);
        } else if (mounted) {
          setPatternsReady(false);
        }
      })
      .catch(() => {
        if (mounted) setPatternsReady(false);
      });
    return () => { mounted = false; };
  }, [profile.id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await api.downloadReport(profile.id);
    } catch (err) {
      alert(`Could not download PDF: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="screen-title">Doctor summary</h1>

      {/* Preview Card */}
      <Card style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '18px 20px', marginBottom: 16 }}>
        <DocThumbnail />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#102A38', marginBottom: 4 }}>
            Attacks logged: {attacks.length}
          </div>
          {patternsReady ? (
            <Pill variant="teal" style={{ marginBottom: 6 }}>Patterns ready</Pill>
          ) : (
            <Pill variant="amber" style={{ marginBottom: 6 }}>Patterns in progress</Pill>
          )}
          <div style={{ fontSize: 12, color: '#526773', lineHeight: 1.4 }}>
            One page with dates, severity and possible patterns.
          </div>
        </div>
      </Card>

      {/* Most recent attacks list */}
      <div style={{ marginBottom: 20 }}>
        <h2 className="card-title">Most recent attacks</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {attacks.slice(0, 3).map((att) => (
            <Card key={att.id} style={{ padding: '12px 16px', margin: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#102A38' }}>
                {formatDateTime(att.attacked_at)}
              </div>
              <div style={{ fontSize: 12, color: '#526773' }}>
                Severity: {att.severity ? att.severity.charAt(0).toUpperCase() + att.severity.slice(1) : 'Not specified'}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Download action */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button
          variant="primary"
          fullWidth
          icon="file-text"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? 'Preparing PDF...' : 'Download PDF'}
        </Button>
        {!isOnline && (
          <span style={{ fontSize: 12, color: '#B45309', textAlign: 'center' }}>
            Creating the PDF needs the backend (offline).
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 10 & 11 Settings & Delete Confirmation
// ============================================================================
export function Screen10Settings({
  profiles = [],
  currentProfile,
  onProfileSelect,
  onProfileUpdated,
  onResetSafety,
  deferredPrompt,
  onProfileCreated,
  onProfileDeleted
}) {
  const [districtInput, setDistrictInput] = useState(currentProfile?.district || 'Coimbatore');
  const [savingDistrict, setSavingDistrict] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // 'data' | 'profile' | null
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileRole, setNewProfileRole] = useState('self');
  const [newProfileDistrict, setNewProfileDistrict] = useState(currentProfile?.district || 'Coimbatore');
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || Boolean(window.navigator.standalone);
  });

  const unsyncedCount = pendingCount();

  useEffect(() => {
    if (currentProfile?.district) setDistrictInput(currentProfile.district);
  }, [currentProfile]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
  };

  const handleSaveDistrict = async () => {
    setSavingDistrict(true);
    try {
      const res = await api.updateProfile(currentProfile.id, { district: districtInput.trim() });
      onProfileUpdated(res);
      alert('District saved.');
    } catch (err) {
      alert(`Could not update district: ${err.message}`);
    } finally {
      setSavingDistrict(false);
    }
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    setIsAddingProfile(true);
    try {
      const created = await api.createProfile({
        name: newProfileName.trim(),
        role: newProfileRole,
        district: newProfileDistrict.trim() || 'Coimbatore'
      });
      setShowAddProfile(false);
      setNewProfileName('');
      onProfileCreated?.(created);
    } catch (err) {
      alert(`Could not add profile: ${err.message}`);
    } finally {
      setIsAddingProfile(false);
    }
  };

  const handleDeleteData = async () => {
    try {
      await api.deleteProfileData(currentProfile.id);
      setConfirmDelete(null);
      alert('Attacks and check-ins deleted.');
      window.location.reload();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDeleteProfile = async () => {
    try {
      await api.deleteProfile(currentProfile.id);
      setConfirmDelete(null);
      alert('Profile deleted.');
      onProfileDeleted?.();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 className="screen-title" style={{ marginBottom: 4 }}>Settings</h1>

      {/* Profile Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#526773' }}>
            Profiles
          </label>
          <button
            type="button"
            className="tt-btn btn-ghost"
            style={{ minHeight: 32, minWidth: 32, padding: '4px 8px', fontSize: 12, color: '#178578', fontWeight: 600, gap: 4 }}
            onClick={() => setShowAddProfile(true)}
          >
            <Icon name="plus" size={14} color="#178578" />
            <span>Add Profile</span>
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {profiles.map((p) => {
            const isSelected = p.id === currentProfile.id;
            return (
              <Card
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  margin: 0,
                  cursor: 'pointer',
                  borderColor: isSelected ? '#178578' : 'rgba(226, 232, 240, 0.75)',
                  backgroundColor: isSelected ? '#E3F3F1' : '#FFFFFF'
                }}
                onClick={() => onProfileSelect(p.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: isSelected ? '#FFFFFF' : '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSelected ? '#178578' : '#526773'
                  }}>
                    <Icon name="user" size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#102A38' }}>
                      {p.name} ({p.role})
                    </div>
                    <div style={{ fontSize: 11, color: '#526773' }}>
                      {p.district || 'No district set'}
                    </div>
                  </div>
                </div>
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: isSelected ? '5px solid #178578' : '2px solid #CBD5E1',
                  backgroundColor: '#FFFFFF'
                }} />
              </Card>
            );
          })}
        </div>
      </div>

      {/* App Installation Card */}
      <Card style={{ margin: 0, padding: '14px 16px' }}>
        <h2 className="card-title">Install App</h2>
        {isInstalled ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#178578', fontSize: 13, fontWeight: 500 }}>
            <Icon name="check-circle" size={18} color="#178578" />
            <span>Installed and running standalone.</span>
          </div>
        ) : deferredPrompt ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="body-text">
              Install TriggerTrace for fast 1-tap logging and reliable offline access without browser address bars.
            </p>
            <Button variant="primary" fullWidth icon="download" onClick={handleInstallClick} style={{ minHeight: 44 }}>
              Install app
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="body-text">
              Install on your phone's home screen:
            </p>
            <div style={{
              backgroundColor: '#F8FAFC',
              borderRadius: 10,
              padding: '10px 12px',
              border: '1px solid #E2E8F0',
              fontSize: 12,
              color: '#102A38',
              lineHeight: 1.4
            }}>
              <b>iPhone / iPad:</b> Tap <b>Share</b> <span style={{ color: '#178578' }}>[⎋]</span> in Safari, then tap <b>Add to Home Screen</b>.
            </div>
          </div>
        )}
      </Card>

      {/* District edit */}
      <Card style={{ margin: 0, padding: '14px 16px' }}>
        <h2 className="card-title">Location</h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input
            type="text"
            value={districtInput}
            onChange={(e) => setDistrictInput(e.target.value)}
            placeholder="e.g. Coimbatore"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 12px',
              border: '1px solid #CBD5E1',
              borderRadius: 10,
              fontSize: 16,
              fontFamily: 'inherit'
            }}
          />
          <Button variant="primary" onClick={handleSaveDistrict} disabled={savingDistrict} style={{ minHeight: 40, padding: '8px 16px' }}>
            Save
          </Button>
        </div>
      </Card>

      {/* Saved on this phone */}
      <Card style={{ margin: 0, padding: '14px 16px' }}>
        <h2 className="card-title">Saved on this phone</h2>
        <p className="body-text" style={{ marginBottom: 10, fontSize: 13 }}>
          {unsyncedCount} items waiting to upload
        </p>
        <Button variant="outline" fullWidth icon="cloud" onClick={flushQueue} style={{ minHeight: 42 }}>
          Upload now
        </Button>
      </Card>

      {/* Your data actions */}
      <Card style={{ margin: 0, padding: '14px 16px' }}>
        <h2 className="card-title" style={{ marginBottom: 10 }}>Your data</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            variant="danger-soft"
            fullWidth
            icon="alert"
            onClick={() => setConfirmDelete('data')}
            style={{ minHeight: 42 }}
          >
            Delete attacks and check-ins
          </Button>
          <Button
            variant="danger-soft"
            fullWidth
            icon="alert"
            onClick={() => setConfirmDelete('profile')}
            style={{ minHeight: 42 }}
          >
            Delete this profile
          </Button>
        </div>
      </Card>

      {/* Safety notice link */}
      <div style={{ textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
        <button
          onClick={onResetSafety}
          style={{
            background: 'none',
            border: 'none',
            color: '#526773',
            fontSize: 12,
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
        >
          View safety notice again
        </button>
      </div>

      {/* Modal: Add Profile */}
      {showAddProfile && (
        <div className="modal-backdrop" onClick={() => setShowAddProfile(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#102A38', marginBottom: 14 }}>
              Add Profile
            </h2>
            <form onSubmit={handleCreateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#526773', display: 'block', marginBottom: 4 }}>
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="e.g. Maya"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: 16 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#526773', display: 'block', marginBottom: 4 }}>
                  Role
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <ChoiceCard
                    selected={newProfileRole === 'self'}
                    onClick={() => setNewProfileRole('self')}
                    title="Self"
                  />
                  <ChoiceCard
                    selected={newProfileRole === 'caregiver'}
                    onClick={() => setNewProfileRole('caregiver')}
                    title="Caregiver"
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#526773', display: 'block', marginBottom: 4 }}>
                  District
                </label>
                <input
                  type="text"
                  value={newProfileDistrict}
                  onChange={(e) => setNewProfileDistrict(e.target.value)}
                  placeholder="e.g. Coimbatore"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: 16 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <Button variant="outline" onClick={() => setShowAddProfile(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={isAddingProfile || !newProfileName.trim()}>
                  {isAddingProfile ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screen 11: Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete === 'data'}
        title="Delete all attacks and check-ins?"
        description="This cannot be undone. The profile itself stays."
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDeleteData}
        confirmText="Delete"
      />
      <ConfirmDialog
        isOpen={confirmDelete === 'profile'}
        title="Delete this profile?"
        description="This will permanently delete this profile and all its logged history."
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDeleteProfile}
        confirmText="Delete"
      />
    </div>
  );
}

// ============================================================================
// 12 Design System Showcase (Route /design)
// ============================================================================
export function Screen12DesignSystem() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="screen-title" style={{ marginBottom: 4 }}>Design system</h1>
        <p className="body-text">Tokens, type, components and touch rules.</p>
      </div>

      {/* Color Tokens */}
      <div>
        <h2 className="card-title">Colour tokens</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Ink #102A38', hex: '#102A38', text: '#FFFFFF' },
            { label: 'Teal #178578', hex: '#178578', text: '#FFFFFF' },
            { label: 'Crimson #B91C1C', hex: '#B91C1C', text: '#FFFFFF' },
            { label: 'Amber #B45309', hex: '#B45309', text: '#FFFFFF' },
            { label: 'Slate #526773', hex: '#526773', text: '#FFFFFF' },
            { label: 'Coral #E76F51', hex: '#E76F51', text: '#FFFFFF' }
          ].map((c) => (
            <div key={c.hex} style={{
              backgroundColor: c.hex,
              borderRadius: 12,
              padding: '16px 8px 10px',
              color: c.text,
              fontSize: 11,
              fontWeight: 600,
              textAlign: 'center'
            }}>
              {c.label}
            </div>
          ))}
        </div>
      </div>

      {/* Typography scale */}
      <Card>
        <h2 className="card-title">Type scale</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Screen title, Bold</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Card header, Medium</div>
          <div style={{ fontSize: 14, color: '#526773' }}>Body text, Regular</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#526773' }}>Caption, Medium</div>
        </div>
      </Card>

      {/* Components preview */}
      <Card>
        <h2 className="card-title" style={{ marginBottom: 12 }}>Components</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <Button variant="primary">Primary</Button>
          <Button variant="outline">Outline</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <ChoiceCard selected={true} title="Selected" />
          <ChoiceCard selected={false} title="Default" />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <Pill variant="crimson">possible higher risk</Pill>
          <Pill variant="amber">logged later</Pill>
          <Pill variant="grey">no clear pattern</Pill>
          <Pill variant="teal">Symptom-free</Pill>
        </div>

        <div style={{ fontSize: 12, color: '#526773', marginBottom: 6 }}>Icons: 2 px stroke, 20 px</div>
        <div style={{ display: 'flex', gap: 14, color: '#178578', marginBottom: 10 }}>
          <Icon name="pulse" size={20} />
          <Icon name="checkin" size={20} />
          <Icon name="patterns" size={20} />
          <Icon name="doctor" size={20} />
          <Icon name="settings" size={20} />
          <Icon name="shield" size={20} />
          <Icon name="humidity" size={20} />
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: '#102A38' }}>
          Touch targets: 48 px minimum
        </div>
      </Card>
    </div>
  );
}
