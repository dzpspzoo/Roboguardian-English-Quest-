// AEGIS AI: rozmowa i analiza przez serwer pośredniczący (server/worker.js).
// Gra nigdy nie zna klucza API. Zna tylko adres serwera i hasło gry (GAME_TOKEN), które rodzic wpisuje
// w panelu rodzica; trzymamy je w localStorage pod kluczem rg.teacher.ai (poza profilem dziecka).
// Do serwera idzie tylko tekst rozmowy i anonimowe liczby; bez imienia i bez nagrań.
import { teacherState } from './schedule.js';
import { ITEMS, CONTRASTS } from './curriculum.js';

const KEY = 'rg.teacher.ai';

export function aiConfig() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
export function setAiConfig(c) {
  try { localStorage.setItem(KEY, JSON.stringify({ url: String(c.url || '').trim().replace(/\/+$/, ''), token: String(c.token || '').trim() })); } catch (e) {}
}
export function aiConfigured() { const c = aiConfig(); return !!(c.url && c.token); }
// Rozmowa włączona: serwer skonfigurowany i rodzic nie wyłączył AI w profilu.
export function aiReady(profile) { return aiConfigured() && teacherState(profile).ai !== 'off'; }

const ERR_PL = {
  token: 'Złe hasło gry (GAME_TOKEN).', budget: 'Wyczerpany budżet AI.', daily: 'Dzisiejszy limit AI wyczerpany. Jutro znowu działa.',
  no_key: 'Na serwerze brak klucza API.', busy: 'Serwer AI jest zajęty, spróbuj za chwilę.', api: 'Błąd Claude API.',
  refusal: 'Model odmówił odpowiedzi.', format: 'Zła odpowiedź modelu.', network: 'Brak połączenia z serwerem AI.', timeout: 'Serwer AI nie odpowiedział na czas.',
};
export const aiErrorPl = code => ERR_PL[code] || 'Nie udało się połączyć z AI.';

async function call(path, body, ms = 20000) {
  const c = aiConfig();
  if (!c.url || !c.token) return { error: 'token' };
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), ms) : null;
  try {
    const r = await fetch(c.url + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json', 'X-Game-Token': c.token } : { 'X-Game-Token': c.token },
      body: body ? JSON.stringify(body) : undefined,
      signal: ac ? ac.signal : undefined,
    });
    const data = await r.json().catch(() => ({ error: 'format' }));
    return r.ok ? data : { error: data.error || 'api' };
  } catch (e) {
    return { error: e && e.name === 'AbortError' ? 'timeout' : 'network' };
  } finally { if (timer) clearTimeout(timer); }
}

export const aiStatus = () => call('/status', null, 10000);

// Zwroty, które dziecko już poznało (AI ma mówić głównie nimi).
export function knownPhrases(profile) {
  const t = teacherState(profile);
  const out = Object.entries(t.items).filter(([id, s]) => s.introduced && ITEMS[id]).map(([id]) => ITEMS[id].en);
  return out.length ? out : ['Hello!', 'Yes.', 'No.', 'Thank you.'];
}

export function aiChat(profile, { topic, history, child, turn, maxTurns }) {
  return call('/chat', { topic, known: knownPhrases(profile), history: (history || []).slice(-10), child: child || '', turn, maxTurns });
}

// Zapis rozmów do podglądu rodzica (ostatnie 10 rozmów, w profilu, nie wychodzi z przeglądarki).
export function logTalk(profile, entry) {
  const t = teacherState(profile);
  t.aiLog = (t.aiLog || []).concat([{ at: Date.now(), ...entry }]).slice(-10);
}

/* ---------- analiza testu startowego ---------- */

// Skrót wyniku testu i postępów: bez imienia, bez surowych odpowiedzi tekstowych.
export function analysisInput(profile) {
  const c = profile.calibration || null;
  const t = teacherState(profile);
  const cal = c && {
    sections: c.sections, contrasts: c.contrasts, errors: c.errors, attention: c.attention,
    profile: c.profile, plan: c.plan, durationSec: c.durationSec,
    context: c.context && { age: c.context.age, yearsLearning: c.context.yearsLearning, mic: c.context.mic },
  };
  const items = Object.entries(t.items).filter(([id]) => ITEMS[id])
    .map(([id, s]) => ({ en: ITEMS[id].en, box: s.box, ok: s.ok || 0, wrong: s.wrong || 0 }));
  const teacher = { day: t.day, items, history: (t.history || []).slice(-14).map(h => ({ type: h.type, min: h.min, stars: h.stars })) };
  const contrasts = Object.keys(CONTRASTS);
  const contrastInfo = contrasts.map(k => `${k}: ${(CONTRASTS[k].a || {}).en || CONTRASTS[k].a}/${(CONTRASTS[k].b || {}).en || CONTRASTS[k].b}`).join('; ');
  return { calibration: cal, teacher, contrasts, contrastInfo };
}

export async function aiAnalyze(profile) {
  const res = await call('/analyze', analysisInput(profile), 60000);
  if (res.error) return res;
  const t = teacherState(profile);
  t.aiPlan = {
    at: Date.now(), basedOn: profile.calibration ? profile.calibration.finishedAt || true : null,
    notes: res.notes_pl, focus: (res.focus_contrasts || []).filter(k => CONTRASTS[k]),
    newPerDay: [1, 2, 3].includes(res.new_per_day) ? res.new_per_day : 3,
    minutes: res.minutes, slowVoice: !!res.slow_voice, writing: res.writing, tips: res.tips_pl || [],
  };
  return { plan: t.aiPlan };
}

// Analiza sama rusza po teście startowym (raz; ponowna próba najwcześniej po 12 h, gdy się nie udała).
export function aiAnalysisDue(profile, now = Date.now()) {
  if (!aiReady(profile) || !profile.calibration) return false;
  const t = teacherState(profile);
  const basedOn = profile.calibration.finishedAt || true;
  if (t.aiPlan && t.aiPlan.basedOn === basedOn) return false;
  return !(t.aiTried && now - t.aiTried < 12 * 3600e3);
}
export async function autoAnalyze(profile, save) {
  if (!aiAnalysisDue(profile)) return null;
  teacherState(profile).aiTried = Date.now();
  save && save(profile);
  const res = await aiAnalyze(profile);
  save && save(profile);
  return res;
}
