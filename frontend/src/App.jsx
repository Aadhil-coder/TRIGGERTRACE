import React, { useState, useEffect } from 'react';
import {
  TopBar,
  BottomNav,
  EmergencyBanner
} from './components';
import {
  Screen01Safety,
  Screen02Home,
  Screen03FollowUp,
  Screen04AddPast,
  Screen05CheckIn,
  Screen07Patterns,
  Screen09DoctorSummary,
  Screen10Settings,
  Screen12DesignSystem
} from './screens';
import {
  api,
  getProfileId,
  setProfileId,
  isSafetyAcked,
  setSafetyAcked,
  subscribe,
  pendingCount
} from './api';

export default function App() {
  const [safetyAcked, setSafetyAckedState] = useState(() => isSafetyAcked());
  const [currentTab, setCurrentTab] = useState('attack'); // 'attack' | 'checkin' | 'patterns' | 'doctor' | 'settings'
  const [subScreen, setSubScreen] = useState(null); // 'followup' | 'add-past' | null
  const [activeAttack, setActiveAttack] = useState(null);
  const [isDesignRoute, setIsDesignRoute] = useState(() => window.location.pathname === '/design');

  const [profiles, setProfiles] = useState([]);
  const [currentProfile, setCurrentProfile] = useState({ id: 1, name: 'Demo user', role: 'self', district: 'Coimbatore' });
  const [attacks, setAttacks] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [, setTick] = useState(0);

  // Sync state & data loader
  const loadData = async (profId) => {
    try {
      const pList = await api.getProfiles();
      setProfiles(pList);
      const active = pList.find(p => p.id === profId) || pList[0] || { id: 1, name: 'Demo user', role: 'self', district: 'Coimbatore' };
      setCurrentProfile(active);

      const attList = await api.getAttacks(active.id);
      setAttacks(attList);

      const chkList = await api.getCheckins(active.id);
      setCheckins(chkList);
    } catch (err) {
      console.warn('Network load failed, using local/cached state:', err.message);
    }
  };

  useEffect(() => {
    const activeProfId = getProfileId();
    loadData(activeProfId);

    const unsub = subscribe(() => {
      setTick(t => t + 1);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handlePopState = () => {
      setIsDesignRoute(window.location.pathname === '/design');
    };
    window.addEventListener('popstate', handlePopState);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      unsub();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleProfileSelect = (id) => {
    setProfileId(id);
    loadData(id);
  };

  const handleProfileCreated = (newProf) => {
    setProfiles(prev => [...prev, newProf]);
    handleProfileSelect(newProf.id);
  };

  const handleProfileDeleted = async () => {
    try {
      const pList = await api.getProfiles();
      setProfiles(pList);
      if (pList.length > 0) {
        handleProfileSelect(pList[0].id);
      } else {
        const defaultProf = await api.createProfile({
          name: 'Demo user',
          role: 'self',
          district: 'Coimbatore'
        });
        setProfiles([defaultProf]);
        handleProfileSelect(defaultProf.id);
      }
    } catch (err) {
      console.warn('Profile deletion reload failed:', err);
    }
  };

  const handleAttackLogged = (attack) => {
    setActiveAttack(attack);
    setAttacks(prev => [attack, ...prev]);
    setSubScreen('followup');
  };

  const handleSubScreenBack = () => {
    setSubScreen(null);
    loadData(currentProfile.id);
  };

  // Determine which screens show back button and hide tab bar
  // Screens 01, 03, 04, 11 show back chevron instead of the tab bar
  const isBackScreen = subScreen === 'followup' || subScreen === 'add-past' || isDesignRoute;
  const hideTabBar = !safetyAcked || isBackScreen;

  return (
    <div className="app-viewport">
      <div className="phone-frame">
        <div className="app-container">
          {/* Consistent Top Bar Header */}
          {safetyAcked && !isDesignRoute && (
            <TopBar
              district={currentProfile?.district || 'Coimbatore'}
              isOnline={isOnline}
              showBack={isBackScreen}
              onBack={handleSubScreenBack}
            />
          )}

          {/* Pinned Emergency Banner on Home Screen (Never scrolled away) */}
          {safetyAcked && !isDesignRoute && currentTab === 'attack' && !subScreen && (
            <div className="pinned-emergency-container">
              <EmergencyBanner />
            </div>
          )}

          {isDesignRoute && (
            <header className="top-bar">
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  setIsDesignRoute(false);
                }}
                className="tt-btn btn-ghost"
                style={{ minHeight: 36, minWidth: 36, padding: 6, gap: 4 }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>← Back to App</span>
              </button>
            </header>
          )}

          {/* Main Scrollable Content */}
          <main className={`app-content ${hideTabBar ? 'no-nav' : ''}`}>
            {/* Safety Gate (Screen 01) */}
            {!safetyAcked ? (
              <Screen01Safety
                onAcknowledge={() => {
                  setSafetyAckedState(true);
                }}
              />
            ) : isDesignRoute ? (
              <Screen12DesignSystem />
            ) : (
              <div key={subScreen || currentTab} className="tab-screen-container">
                {subScreen === 'followup' ? (
                  <Screen03FollowUp
                    attack={activeAttack}
                    onFinished={handleSubScreenBack}
                  />
                ) : subScreen === 'add-past' ? (
                  <Screen04AddPast
                    profile={currentProfile}
                    onSaved={handleSubScreenBack}
                    onCancel={handleSubScreenBack}
                  />
                ) : currentTab === 'attack' ? (
                  <Screen02Home
                    profile={currentProfile}
                    attacks={attacks}
                    onAttackLogged={handleAttackLogged}
                    onNavigate={(dest) => {
                      if (dest === 'add-past') setSubScreen('add-past');
                      if (dest === 'checkin') setCurrentTab('checkin');
                    }}
                  />
                ) : currentTab === 'checkin' ? (
                  <Screen05CheckIn
                    profile={currentProfile}
                    checkins={checkins}
                    onSaved={() => loadData(currentProfile.id)}
                  />
                ) : currentTab === 'patterns' ? (
                  <Screen07Patterns
                    profile={currentProfile}
                  />
                ) : currentTab === 'doctor' ? (
                  <Screen09DoctorSummary
                    profile={currentProfile}
                    attacks={attacks}
                    isOnline={isOnline}
                  />
                ) : currentTab === 'settings' ? (
                  <Screen10Settings
                    profiles={profiles}
                    currentProfile={currentProfile}
                    onProfileSelect={handleProfileSelect}
                    onProfileUpdated={(updated) => {
                      setCurrentProfile(updated);
                      loadData(updated.id);
                    }}
                    onResetSafety={() => {
                      setSafetyAcked(false);
                      setSafetyAckedState(false);
                    }}
                    deferredPrompt={deferredPrompt}
                    onProfileCreated={handleProfileCreated}
                    onProfileDeleted={handleProfileDeleted}
                  />
                ) : null}
              </div>
            )}
          </main>

          {/* Bottom Floating Frosted 5-Tab Bar */}
          {!hideTabBar && (
            <BottomNav
              activeTab={currentTab}
              onSelectTab={(tabId) => {
                setSubScreen(null);
                setCurrentTab(tabId);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
