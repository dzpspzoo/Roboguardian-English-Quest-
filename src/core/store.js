// Profil dziecka i zapis postępów (localStorage, klucz rg.v1). Patrz docs/ARCHITEKTURA.md.
const KEY = 'rg.v1';
const listeners = new Set();
let state = load();

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) {}
  return { v: 1, activeId: null, profiles: {} };
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Zapis nieudany', e); }
  listeners.forEach(fn => { try { fn(getProfile()); } catch (e) {} });
}
export function newProfileData(name, avatar) {
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    id, name: String(name || 'Strażnik').slice(0, 24), avatar: avatar || '🛡️', createdAt: new Date().toISOString(),
    settings: { musicVol: 0.6, sfxVol: 0.8, slowVoice: false, tablet: false },
    progress: { storySeen: false, calibrationDone: false, chapter: 1, parts: [], missions: {} },
    calibration: null, assistant: null,
  };
}
export function listProfiles() { return Object.values(state.profiles).sort((a, b) => (b.lastPlayed || b.createdAt).localeCompare(a.lastPlayed || a.createdAt)); }
export function createProfile(name, avatar) { const p = newProfileData(name, avatar); state.profiles[p.id] = p; state.activeId = p.id; persist(); return p; }
export function selectProfile(id) { if (state.profiles[id]) { state.activeId = id; state.profiles[id].lastPlayed = new Date().toISOString(); persist(); } return getProfile(); }
export function deleteProfile(id) { delete state.profiles[id]; if (state.activeId === id) state.activeId = null; persist(); }
export function getProfile() { return state.activeId ? state.profiles[state.activeId] || null : null; }
export function saveProfile(p) { const cur = p || getProfile(); if (!cur) return; state.profiles[cur.id] = cur; persist(); }
export function onProfileChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

let session = 's' + Date.now().toString(36);
export function sessionId() { return session; }

// Zapis jednej odpowiedzi dziecka (format w docs/ARCHITEKTURA.md).
export function record(event) {
  const p = getProfile(); if (!p) return;
  const ev = Object.assign({ t: Date.now(), session }, event);
  const A = window.RGAssistant;
  if (A && typeof A.record === 'function') { try { A.record(p, ev); } catch (e) { console.warn('RGAssistant.record', e); } }
  else { p.assistant = p.assistant || { v: 1, log: [] }; (p.assistant.log = p.assistant.log || []).push(ev); if (p.assistant.log.length > 3000) p.assistant.log.splice(0, p.assistant.log.length - 3000); }
  saveProfile(p);
}

export function exportAll() { return JSON.stringify({ exported: new Date().toISOString(), ...state }, null, 2); }
export function importAll(json) { const s = JSON.parse(json); if (!s || s.v !== 1 || !s.profiles) throw new Error('To nie jest plik zapisu Roboguardian'); state = { v: 1, activeId: s.activeId, profiles: s.profiles }; persist(); }
