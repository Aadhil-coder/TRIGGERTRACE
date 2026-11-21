// ---- TriggerTrace API & Offline Queue ----

const QUEUE_KEY = 'tt_queue';
const ID_MAP_KEY = 'tt_id_map';
const PROFILE_KEY = 'tt_profile_id';
const SAFETY_KEY = 'tt_safety_ack';

let listeners = [];

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function subscribe(listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(fn => fn !== listener);
  };
}

export function getProfileId() {
  const saved = localStorage.getItem(PROFILE_KEY);
  return saved ? parseInt(saved, 10) : 1;
}

export function setProfileId(id) {
  localStorage.setItem(PROFILE_KEY, String(id));
  notifyListeners();
}

export function isSafetyAcked() {
  return localStorage.getItem(SAFETY_KEY) === 'true';
}

export function setSafetyAcked(acked) {
  if (acked) {
    localStorage.setItem(SAFETY_KEY, 'true');
  } else {
    localStorage.removeItem(SAFETY_KEY);
  }
  notifyListeners();
}

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notifyListeners();
}

export function getIdMap() {
  try {
    return JSON.parse(localStorage.getItem(ID_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveIdMap(map) {
  localStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
}

export function pendingCount() {
  return getQueue().filter(item => !item.failed).length;
}

// Low-level fetch wrapper with JSON error handling
async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    const errorMsg = (data && data.error) || response.statusText || 'Request failed';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ---- Direct API Endpoints ----

export const api = {
  // Health
  getHealth: () => request('/api/health'),

  // Profiles
  getProfiles: () => request('/api/profiles'),
  createProfile: (profile) => request('/api/profiles', {
    method: 'POST',
    body: JSON.stringify(profile)
  }),
  updateProfile: (id, updates) => request(`/api/profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  }),
  deleteProfileData: (id) => request(`/api/profiles/${id}/data`, {
    method: 'DELETE'
  }),
  deleteProfile: (id) => request(`/api/profiles/${id}`, {
    method: 'DELETE'
  }),

  // Attacks
  getAttacks: (profileId) => request(`/api/attacks?profile_id=${profileId}`),
  updateAttack: (id, updates) => request(`/api/attacks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  }),

  // Check-ins
  getCheckins: (profileId, fromDate, toDate) => {
    let url = `/api/checkins?profile_id=${profileId}`;
    if (fromDate) url += `&from=${fromDate}`;
    if (toDate) url += `&to=${toDate}`;
    return request(url);
  },

  // Patterns
  getPatterns: (profileId) => request(`/api/patterns?profile_id=${profileId}`),

  // Doctor Report PDF
  downloadReport: async (profileId) => {
    const res = await fetch(`/api/report?profile_id=${profileId}`);
    if (!res.ok) {
      let errText = 'Failed to generate PDF';
      try {
        const errJson = await res.json();
        if (errJson.error) errText = errJson.error;
      } catch {}
      throw new Error(errText);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `triggertrace_summary_profile_${profileId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  }
};

// ---- Offline Queue Operations ----

export async function logAttack({ profileId, district, attacked_at, live = true }) {
  const payload = { profile_id: profileId, district, attacked_at, live };

  if (navigator.onLine) {
    try {
      const result = await request('/api/attacks', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return { ...result, queued: false };
    } catch (err) {
      // If error is client rejection (e.g. future time), throw directly
      if (err.status && err.status < 500) {
        throw err;
      }
      // Otherwise fallback to queue on network error
    }
  }

  // Enqueue locally
  const clientId = `local_att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();
  const localIso = attacked_at || now.toISOString().slice(0, 19);

  const localEntry = {
    id: clientId,
    profile_id: profileId,
    district,
    attacked_at: localIso,
    severity: null,
    inhaler_used: null,
    logged_later: attacked_at && !live ? 1 : 0,
    queued: true,
    created_at: now.toISOString()
  };

  const queue = getQueue();
  queue.push({
    type: 'attack',
    clientId,
    payload,
    timestamp: Date.now()
  });
  saveQueue(queue);

  return localEntry;
}

export async function saveFollowUp(attackId, data) {
  const idMap = getIdMap();
  const realId = idMap[attackId] || attackId;

  // If the attack already has a numeric server ID and we are online, try sending immediately
  if (typeof realId === 'number' || !String(realId).startsWith('local_')) {
    if (navigator.onLine) {
      try {
        const res = await api.updateAttack(realId, data);
        return res;
      } catch (err) {
        if (err.status && err.status < 500) throw err;
      }
    }
  }

  // Hold follow-up in the queue until attack has uploaded
  const queue = getQueue();
  queue.push({
    type: 'followup',
    attackId: String(attackId),
    payload: data,
    timestamp: Date.now()
  });
  saveQueue(queue);
  return { id: attackId, ...data, queued: true };
}

export async function saveCheckin(data) {
  if (navigator.onLine) {
    try {
      const res = await request('/api/checkins', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return { ...res, queued: false };
    } catch (err) {
      if (err.status && err.status < 500) throw err;
    }
  }

  const queue = getQueue();
  queue.push({
    type: 'checkin',
    payload: data,
    timestamp: Date.now()
  });
  saveQueue(queue);
  return { ...data, queued: true };
}

export async function flushQueue() {
  const queue = getQueue();
  if (queue.length === 0) return;

  const idMap = getIdMap();
  const remaining = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];

    if (item.failed) {
      remaining.push(item);
      continue;
    }

    try {
      if (item.type === 'attack') {
        const res = await request('/api/attacks', {
          method: 'POST',
          body: JSON.stringify(item.payload)
        });
        idMap[item.clientId] = res.id;
        saveIdMap(idMap);
      } else if (item.type === 'followup') {
        const targetId = idMap[item.attackId] || item.attackId;
        if (typeof targetId === 'number' || !String(targetId).startsWith('local_')) {
          await api.updateAttack(targetId, item.payload);
        } else {
          // Attack not uploaded yet, hold it
          remaining.push(item);
          continue;
        }
      } else if (item.type === 'checkin') {
        await request('/api/checkins', {
          method: 'POST',
          body: JSON.stringify(item.payload)
        });
      }
    } catch (err) {
      if (!navigator.onLine || !err.status || err.status >= 500) {
        // Network/server failure: stop processing and keep the rest of the queue
        remaining.push(...queue.slice(i));
        break;
      } else {
        // Validation / client error: keep item with error note so nothing is lost silently
        item.failed = true;
        item.errorNote = err.message || 'Rejected by server';
        remaining.push(item);
      }
    }
  }

  saveQueue(remaining);
}

// Set up periodic sync and online listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushQueue();
    notifyListeners();
  });
  window.addEventListener('offline', () => {
    notifyListeners();
  });
  setInterval(flushQueue, 30000);
}
