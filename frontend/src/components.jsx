import React from 'react';
import {
  Activity,
  CalendarCheck,
  BarChart2,
  FileText,
  Sliders,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  ChevronLeft,
  UploadCloud,
  User,
  HeartPulse,
  Droplets,
  Wind,
  Check,
  X,
  Thermometer,
  CloudRain,
  Plus,
  Download
} from 'lucide-react';

// Central Icon mapping
export function Icon({ name, size = 20, strokeWidth = 2, className = '', color }) {
  const iconProps = { size, strokeWidth, className, color };
  switch (name) {
    case 'activity':
    case 'pulse':
      return <Activity {...iconProps} />;
    case 'calendar-check':
    case 'checkin':
      return <CalendarCheck {...iconProps} />;
    case 'bar-chart-2':
    case 'patterns':
      return <BarChart2 {...iconProps} />;
    case 'file-text':
    case 'doctor':
      return <FileText {...iconProps} />;
    case 'sliders':
    case 'settings':
      return <Sliders {...iconProps} />;
    case 'alert':
    case 'alert-triangle':
      return <AlertTriangle {...iconProps} />;
    case 'clock':
      return <Clock {...iconProps} />;
    case 'check-circle':
      return <CheckCircle2 {...iconProps} />;
    case 'shield':
      return <ShieldAlert {...iconProps} />;
    case 'back':
    case 'chevron-left':
      return <ChevronLeft {...iconProps} />;
    case 'upload':
    case 'cloud':
      return <UploadCloud {...iconProps} />;
    case 'user':
      return <User {...iconProps} />;
    case 'droplets':
    case 'humidity':
      return <Droplets {...iconProps} />;
    case 'wind':
    case 'pm25':
    case 'pm25_lag1':
      return <Wind {...iconProps} />;
    case 'thermometer':
    case 'temperature':
      return <Thermometer {...iconProps} />;
    case 'cloud-rain':
    case 'rainfall':
    case 'rain':
      return <CloudRain {...iconProps} />;
    case 'plus':
      return <Plus {...iconProps} />;
    case 'download':
      return <Download {...iconProps} />;
    case 'check':
      return <Check {...iconProps} />;
    case 'x':
      return <X {...iconProps} />;
    default:
      return <Activity {...iconProps} />;
  }
}

// Button component
export function Button({
  children,
  variant = 'primary', // primary | ink | outline | danger | danger-soft | ghost
  icon,
  iconRight,
  fullWidth = false,
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  ariaLabel
}) {
  const variantClass = `btn-${variant}`;
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      className={`tt-btn ${variantClass} ${widthClass} ${className}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={18} />}
    </button>
  );
}

// Card container
export function Card({ children, className = '', style = {}, onClick }) {
  return (
    <div
      className={`tt-card ${className}`}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// Pill component
export function Pill({ children, variant = 'neutral', className = '' }) {
  // teal | crimson | amber | coral | grey | neutral
  return (
    <span className={`tt-pill pill-${variant} ${className}`}>
      {children}
    </span>
  );
}

// Choice card for options (Severity, Check-in, etc.)
export function ChoiceCard({
  selected = false,
  onClick,
  title,
  subtitle,
  icon,
  children,
  className = ''
}) {
  return (
    <div
      className={`choice-card ${selected ? 'selected' : ''} ${className}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
    >
      {icon && <div className="choice-icon">{icon}</div>}
      {title && <span className="choice-title">{title}</span>}
      {subtitle && <span className="choice-sub" style={{ fontSize: 11, color: '#526773' }}>{subtitle}</span>}
      {children}
    </div>
  );
}

// Circular progress ring (for 08 Patterns waiting)
export function RingProgress({ value, max, label, color = '#178578', size = 80, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(1, Math.max(0, value / max));
  const strokeDashoffset = circumference - (ratio * circumference);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 700,
          color: '#102A38'
        }}>
          {value}/{max}
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#526773' }}>{label}</span>
    </div>
  );
}

// Range Bar (0 to 4 scale, interval segment, point marker at odds_ratio, 1.0 vertical tick)
export function RangeBar({ oddsRatio, rangeLow, rangeHigh, verdict }) {
  // Scale mapping: 0 to 4.0 mapped to 0% to 100%
  const clamp = (val) => Math.max(0, Math.min(4.0, val));
  const toPercent = (val) => `${(clamp(val) / 4.0) * 100}%`;

  const leftPercent = (clamp(rangeLow) / 4.0) * 100;
  const rightPercent = (clamp(rangeHigh) / 4.0) * 100;
  const widthPercent = Math.max(2, rightPercent - leftPercent);

  // Interval color based on verdict
  let intervalColor = '#94A3B8'; // grey
  if (verdict === 'possible higher risk') {
    intervalColor = '#B91C1C'; // crimson
  } else if (verdict === 'possible lower risk') {
    intervalColor = '#178578'; // teal
  }

  return (
    <div className="range-bar-wrapper">
      <div className="range-bar-track">
        {/* Baseline 1.0 vertical line */}
        <div className="range-bar-tick-1" title="Baseline (1.0)" />

        {/* Interval bar */}
        <div
          className="range-bar-interval"
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            backgroundColor: intervalColor
          }}
        />

        {/* Point estimate marker */}
        <div
          className="range-bar-point"
          style={{ left: toPercent(oddsRatio) }}
          title={`Odds Ratio: ${oddsRatio}`}
        />
      </div>
    </div>
  );
}

// 7-day strip (Screen 05 Check-in)
// days: array of 7 items [{ dayNum, dateStr, status: 'symptom-free' | 'symptoms' | 'unanswered' }]
export function DayStrip({ days = [], selectedDate, onSelectDate }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0' }}>
      {days.map((d, idx) => {
        const isSelected = selectedDate === d.dateStr;
        let style = {
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
          cursor: onSelectDate ? 'pointer' : 'default',
          transition: 'all 0.15s ease'
        };

        if (d.status === 'symptom-free') {
          // filled teal dot
          style.backgroundColor = '#178578';
          style.color = '#FFFFFF';
        } else if (d.status === 'symptoms') {
          // filled coral dot
          style.backgroundColor = '#E76F51';
          style.color = '#FFFFFF';
        } else {
          // unanswered: solid soft muted filled dot
          style.backgroundColor = '#E2E8F0';
          style.color = '#64748B';
        }

        if (isSelected) {
          style.boxShadow = '0 0 0 3px #178578';
          style.transform = 'scale(1.1)';
        }

        return (
          <div
            key={idx}
            onClick={() => onSelectDate?.(d.dateStr)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: onSelectDate ? 'pointer' : 'default' }}
          >
            <span style={{ fontSize: 11, color: isSelected ? '#178578' : '#526773', fontWeight: isSelected ? 700 : 500 }}>
              {d.dayNum}
            </span>
            <div style={style}>
              {d.status === 'symptom-free' && <Icon name="check" size={13} color="#FFF" />}
              {d.status === 'symptoms' && <Icon name="alert" size={13} color="#FFF" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// PDF Document Thumbnail Preview
export function DocThumbnail() {
  return (
    <div style={{
      width: 76,
      height: 96,
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      border: '1px solid #E2E8F0',
      boxShadow: '0 4px 10px rgba(16,42,56,0.08)',
      padding: '8px 6px',
      display: 'flex',
      flexDirection: 'column',
      gap: 5
    }}>
      {/* Top teal header band */}
      <div style={{ width: '100%', height: 14, backgroundColor: '#178578', borderRadius: 3 }} />
      {/* Mock paragraph lines */}
      <div style={{ width: '85%', height: 4, backgroundColor: '#CBD5E1', borderRadius: 2 }} />
      <div style={{ width: '95%', height: 4, backgroundColor: '#E2E8F0', borderRadius: 2 }} />
      <div style={{ width: '90%', height: 4, backgroundColor: '#CBD5E1', borderRadius: 2 }} />
      <div style={{ width: '70%', height: 4, backgroundColor: '#E2E8F0', borderRadius: 2 }} />
      <div style={{ width: '80%', height: 4, backgroundColor: '#CBD5E1', borderRadius: 2 }} />
    </div>
  );
}

// Confirm Dialog (Screen 11)
export function ConfirmDialog({
  isOpen,
  title,
  description,
  onCancel,
  onConfirm,
  confirmText = 'Delete',
  cancelText = 'Cancel'
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          backgroundColor: '#FEF2F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          color: '#B91C1C'
        }}>
          <AlertTriangle size={28} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#102A38', marginBottom: 8 }}>
          {title}
        </h2>
        <p style={{ fontSize: 13, color: '#526773', marginBottom: 24, lineHeight: 1.45 }}>
          {description}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Button variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Emergency Banner (Home screen, top of check-in, etc.)
export function EmergencyBanner() {
  return (
    <div className="emergency-banner" role="alert">
      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        During a severe attack, follow your asthma action plan or call emergency services first.
      </div>
    </div>
  );
}

// Sync Banner (When items are waiting to upload)
export function SyncBanner({ count, onUploadClick }) {
  if (!count || count <= 0) return null;

  return (
    <div className="sync-banner">
      <UploadCloud size={18} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        {count} saved on this phone. They upload when you are online.
      </div>
      {onUploadClick && (
        <button
          onClick={onUploadClick}
          style={{
            background: 'none',
            border: 'none',
            color: '#B45309',
            textDecoration: 'underline',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer'
          }}
        >
          Upload now
        </button>
      )}
    </div>
  );
}

// Top Bar header
export function TopBar({
  district = 'Coimbatore',
  isOnline = true,
  showBack = false,
  onBack
}) {
  return (
    <header className="top-bar">
      <div className="top-bar-left">
        {showBack ? (
          <button
            onClick={onBack}
            className="tt-btn btn-ghost"
            style={{ minHeight: 36, minWidth: 36, padding: 6, gap: 4 }}
            aria-label="Back"
          >
            <ChevronLeft size={20} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#102A38' }}>Back</span>
          </button>
        ) : (
          <>
            <Activity size={22} color="#178578" />
            <span className="brand-title">TriggerTrace</span>
          </>
        )}
      </div>

      <div className="status-pill" title={isOnline ? district : 'Offline'}>
        <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
        <span className="status-pill-text">{isOnline ? district : 'Offline'}</span>
      </div>
    </header>
  );
}

// Bottom Nav Tab Bar (Screen 02, 05, 07/08, 09, 10)
export function BottomNav({ activeTab, onSelectTab }) {
  const tabs = [
    { id: 'attack', label: 'Attack', icon: 'pulse' },
    { id: 'checkin', label: 'Check-in', icon: 'checkin' },
    { id: 'patterns', label: 'Patterns', icon: 'patterns' },
    { id: 'doctor', label: 'Doctor', icon: 'doctor' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  return (
    <nav className="bottom-nav" aria-label="Bottom navigation">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`nav-tab ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
            aria-label={tab.label}
          >
            <Icon name={tab.icon} size={20} color={isActive ? '#178578' : '#526773'} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
