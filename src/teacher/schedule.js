// Nauczyciel AEGIS-7: czysta logika (bez DOM), testowana w node. Stan dziecka: profile.teacher.
// Rytm dnia (blokada po misji), PIN rodzica, powtórki rozłożone w czasie, plan Misji dnia.

export const HOUR = 3600e3, DAY = 24 * HOUR;
// Odstępy powtórek (dni) dla pudełek 0..5: 0 = jeszcze dziś/jutro, potem 1, 2, 4, 7, 14 dni.
export const INTERVALS = [0, 1, 2, 4, 7, 14];
// Drabina: 0 słyszę → 1 rozpoznaję → 2 mówię → 3 piszę → 4 umiem
export const STAGES = ['hear', 'recognize', 'say', 'write', 'known'];
// Nagroda (część AEGIS-a do druku) co 5 Misji dnia: 16 nagród na ok. 84 dni kursu, składanie trwa tygodnie, nie dni.
export const PART_EVERY = 5;
const MAX_NEW = 3, MAX_REVIEW = 5, MAX_REVIEW_DAY = 8, GAP_REVIEW_DAYS = 3;

export function teacherState(profile) {
  const t = profile.teacher = profile.teacher || {};
  t.v = 1;
  t.day = t.day || 0;                 // ile Misji dnia ukończono (indeks kolejnego dnia kursu)
  t.items = t.items || {};            // id zwrotu -> { box, stage, due, seen, ok, wrong, last }
  t.rhythm = t.rhythm || { mode: '12h', hours: 12 };
  t.unlocks = t.unlocks || [];        // odblokowania przez rodzica (czas)
  t.history = t.history || [];        // { at, day, type, min, stars }
  return t;
}

/* ---------- zegar i blokada ---------- */

// Czas „bez cofania”: gra pamięta najpóźniejszy widziany czas, więc cofnięcie zegara nie otwiera misji.
export function clock(profile, now = Date.now()) {
  const t = teacherState(profile);
  if (!t.maxSeen || now > t.maxSeen) t.maxSeen = now;
  return Math.max(now, t.maxSeen);
}

const isSpecial = id => /^sp-/.test(id) || id === 'paliwo';
// Ostatnie ukończenie misji, która zamyka dzień: Misja dnia albo misja rozdziału (nie specjalna).
export function lastDone(profile) {
  const t = teacherState(profile);
  let last = t.lastDoneAt || 0;
  const ms = (profile.progress && profile.progress.missions) || {};
  for (const [id, st] of Object.entries(ms)) {
    if (isSpecial(id) || !st || !st.last) continue;
    const x = Date.parse(st.last); if (x > last) last = x;
  }
  return last;
}

export function opensAt(profile) {
  const t = teacherState(profile);
  const last = lastDone(profile);
  if (!last) return 0;
  const r = t.rhythm || {};
  if (r.mode === 'morning') {           // następnego dnia od 6:00, ale nie wcześniej niż 8 h po misji
    const d = new Date(last); d.setDate(d.getDate() + 1); d.setHours(6, 0, 0, 0);
    return Math.max(d.getTime(), last + 8 * HOUR);
  }
  return last + (Number(r.hours) || 12) * HOUR;
}

export function gate(profile, now = Date.now()) {
  const t = teacherState(profile);
  const n = clock(profile, now);
  const last = lastDone(profile);
  const at = opensAt(profile);
  if (!last || n >= at) return { open: true, reason: 'time', opensAt: at };
  if (t.unlockedAfter && t.unlockedAfter >= last) return { open: true, reason: 'parent', opensAt: at };
  return { open: false, reason: 'wait', opensAt: at, msLeft: at - n };
}

export function parentUnlock(profile, now = Date.now()) {
  const t = teacherState(profile);
  t.unlockedAfter = lastDone(profile) || now;
  t.unlocks.push(now); if (t.unlocks.length > 100) t.unlocks.shift();
}

export function markDone(profile, info = {}, now = Date.now()) {
  const t = teacherState(profile);
  t.lastDoneAt = clock(profile, now);
  t.history.push({ at: now, ...info }); if (t.history.length > 400) t.history.shift();
}

export function fmtLeft(ms) {
  const m = Math.max(1, Math.ceil(ms / 60e3));
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} h ${r ? r + ' min' : ''}`.trim() : `${r} min`;
}

/* ---------- PIN rodzica (tylko przed dzieckiem, nie zabezpieczenie danych) ---------- */
export function pinHash(pin, salt = 'aegis7') {
  let h = 2166136261;
  for (const c of salt + ':' + String(pin)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}
export function setPin(profile, pin) { const t = teacherState(profile); t.pinHash = pin ? pinHash(pin, profile.id) : null; }
export function checkPin(profile, pin) { const t = teacherState(profile); return !!t.pinHash && t.pinHash === pinHash(pin, profile.id); }

/* ---------- powtórki rozłożone w czasie ---------- */
export function itemState(profile, id) {
  const t = teacherState(profile);
  return t.items[id] || (t.items[id] = { box: 0, stage: 0, due: 0, seen: 0, ok: 0, wrong: 0, okDays: [] });
}

// Wynik jednego przypomnienia. firstTry = trafione za 1. razem bez podpowiedzi.
export function review(profile, id, firstTry, { mode = 'recognize', now = Date.now() } = {}) {
  const s = itemState(profile, id);
  s.seen++; s.last = now;
  const today = dayKey(now);
  if (firstTry) {
    s.ok++;
    // pudełko rośnie najwyżej raz dziennie: powtórzenie w tej samej sesji nie udaje nauki rozłożonej w czasie
    if (!s.okDays.includes(today)) { s.okDays.push(today); if (s.okDays.length > 6) s.okDays.shift(); s.box = Math.min(INTERVALS.length - 1, s.box + 1); }
    // na kolejny szczebel drabiny: 2 trafienia za 1. razem w różne dni na obecnym szczeblu
    const need = STAGES.indexOf(mode);
    if (need >= s.stage && s.okDays.length >= 2 && s.stage < STAGES.length - 1) { s.stage++; s.okDays = [today]; }
  } else {
    s.wrong++; s.box = s.box > 1 ? 1 : 0; s.okDays = [];
  }
  s.due = startOfDay(now) + INTERVALS[s.box] * DAY;
  return s;
}

// Pierwsze spotkanie z nowym zwrotem (pokaz): wraca jutro.
export function introduce(profile, id, now = Date.now()) {
  const s = itemState(profile, id);
  if (!s.introduced) { s.introduced = now; s.box = 0; s.due = startOfDay(now) + DAY; }
  return s;
}

export function dueItems(profile, now = Date.now(), limit = MAX_REVIEW) {
  const t = teacherState(profile);
  return Object.entries(t.items)
    .filter(([, s]) => s.introduced && s.due <= now)
    .sort((a, b) => (a[1].due - b[1].due) || (a[1].box - b[1].box))
    .slice(0, limit).map(([id]) => id);
}

// Słabe zwroty (do dnia powtórki, gdy mało zaległych)
export function weakItems(profile, limit = 4) {
  const t = teacherState(profile);
  return Object.entries(t.items).filter(([, s]) => s.introduced)
    .sort((a, b) => (a[1].box - b[1].box) || (b[1].wrong - a[1].wrong)).slice(0, limit).map(([id]) => id);
}

/* ---------- plan Misji dnia ---------- */
// course = tablica dni z curriculum.js; zwraca, co dziś robimy.
export function planToday(profile, course, now = Date.now()) {
  const t = teacherState(profile);
  const idx = Math.min(t.day, course.length - 1);
  const finished = t.day >= course.length;
  let day = course[idx];
  const sinceLast = t.lastDoneAt ? now - t.lastDoneAt : 0;
  // po przerwie dłuższej niż 3 dni: najpierw powtórka, bez nowego materiału i bez przesuwania kursu
  const comeback = t.day > 0 && sinceLast > GAP_REVIEW_DAYS * DAY && !t.comebackDone;
  const type = finished || comeback ? 'review' : day.type;
  const limit = type === 'review' ? MAX_REVIEW_DAY : MAX_REVIEW;
  let reviewIds = dueItems(profile, now, limit);
  if (type !== 'learn' && reviewIds.length < limit) {
    for (const id of weakItems(profile, limit)) if (!reviewIds.includes(id) && reviewIds.length < limit) reviewIds.push(id);
  }
  return {
    index: idx, number: idx + 1, total: course.length, type, comeback, finished,
    day, newIds: type === 'learn' ? (day.items || []).slice(0, MAX_NEW) : [], reviewIds,
  };
}

// Po ukończeniu Misji dnia. Zwraca id części do przyznania (co PART_EVERY misji) albo null.
export function finishToday(profile, plan, { stars = 2, minutes = 0, now = Date.now(), partOrder = [] } = {}) {
  const t = teacherState(profile);
  if (plan.comeback) t.comebackDone = true;
  else { t.comebackDone = false; if (!plan.finished) t.day = plan.index + 1; }
  t.energy = (t.energy || 0) + 1;
  markDone(profile, { day: plan.number, type: plan.type, min: Math.round(minutes), stars }, now);
  if (t.energy % PART_EVERY !== 0) return null;
  const have = new Set((profile.progress && profile.progress.parts) || []);
  return partOrder.find(p => !have.has(p)) || null;
}

/* ---------- zmęczenie w sesji ---------- */
// answers: [{ ok, ms }] z bieżącej misji; true = skracamy misję do łatwego finału
export function tired(answers, elapsedMs) {
  if (elapsedMs > 12 * 60e3) return true;
  const last = answers.slice(-3);
  return last.length === 3 && last.every(a => !a.ok && a.ms < 1500);
}

export function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function dayKey(t) { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
