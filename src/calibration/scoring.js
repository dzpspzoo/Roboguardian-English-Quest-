// Ocena testu startowego: z listy odpowiedzi buduje wynik "roboguardian.calibration/1".
// Czyste funkcje bez DOM, testowane w tests/scoring.test.mjs.

export const SCHEMA = 'roboguardian.calibration/1';
export const LEVELS = ['A', 'B', 'C'];

// Kolejność, w jakiej uczymy kontrastów, gdy kilka jest równie słabych.
export const CONTRAST_PRIORITY = ['i_ee', 'ae_e', 't_d_final', 'th_s_f', 'p_b', 'w_v', 'h'];

// Typ błędu w pisowni/wyborze zapisu -> kontrast dźwiękowy, który za nim stoi.
const ERROR_TO_CONTRAST = {
  vowel_i_ee: 'i_ee', vowel_i_e: 'i_ee', vowel_ae_e: 'ae_e', voicing_t_d: 't_d_final',
  th: 'th_s_f', w_v: 'w_v', h_drop: 'h', voicing_p_b: 'p_b'
};

// Skill testu -> skill w zdarzeniach asystenta (docs/ARCHITEKTURA.md).
export function eventSkill(section, contrast) {
  switch (section) {
    case 'words': return 'vocab';
    case 'contrasts': return contrast ? 'phoneme.' + contrast : 'listening';
    case 'phonics': return 'reading';
    case 'reading': return 'reading';
    case 'listening': return 'listening';
    case 'spelling': return 'spelling';
    case 'speaking': return 'speaking';
    default: return section;
  }
}

// Klasyfikacja błędu przy układaniu słowa z liter.
export function classifySpelling(target, answer) {
  const t = String(target).toLowerCase();
  const a = String(answer || '').toLowerCase().trim();
  if (a === t) return null;
  if (!a) return 'missing_letter';
  if (/[ąćęłńóśźż]/.test(a)) return 'polish_phonetic';
  if (/sz|cz|dz/.test(a) && !/sz|cz|dz/.test(t)) return 'polish_phonetic';
  if (a.includes('y') && !t.includes('y') && t.includes('i')) return 'polish_phonetic';
  if (a.length === t.length) {
    const diffs = [];
    for (let i = 0; i < t.length; i++) if (t[i] !== a[i]) diffs.push([t[i], a[i], i]);
    if (diffs.length === 1) {
      const [x, y, i] = diffs[0];
      const pair = [x, y].sort().join('');
      if (pair === 'dt' && i === t.length - 1) return 'voicing_t_d';
      if (pair === 'bp') return 'voicing_p_b';
      if (pair === 'ae') return 'vowel_ae_e';
      if (pair === 'ei') return 'vowel_i_e';
      if (pair === 'vw') return 'w_v';
      if ((x === 'k' && y === 'c') || (x === 'c' && y === 'k')) return 'polish_phonetic';
    }
    if ([...a].sort().join('') === [...t].sort().join('')) return 'letter_order';
  }
  if (t.startsWith('th') && /^(f|t|s|d)/.test(a) && !a.startsWith('th')) return 'th';
  if (t.startsWith('h') && a === t.slice(1)) return 'h_drop';
  if (a.length === t.length - 1) {
    for (let i = 0; i < t.length; i++) if (t.slice(0, i) + t.slice(i + 1) === a) return 'missing_letter';
  }
  return 'other';
}

function mean(xs) { return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0; }
function round(x, d = 2) { const f = 10 ** d; return Math.round(x * f) / f; }

// Nachylenie prostej (indeks pytania -> czas odpowiedzi), w ms na pytanie.
function slope(ys) {
  const n = ys.length; if (n < 3) return 0;
  const xm = (n - 1) / 2, ym = mean(ys);
  let num = 0, den = 0;
  ys.forEach((y, i) => { num += (i - xm) * (y - ym); den += (i - xm) ** 2; });
  return den ? num / den : 0;
}

function sectionSummary(items, mode) {
  const scored = items.filter(i => i.correct !== null && i.correct !== undefined);
  const correct = scored.filter(i => i.correct).length;
  const s = { n: scored.length, correct, score: scored.length ? round(correct / scored.length) : null, level: null, stoppedEarly: false };
  if (mode === 'levels') {
    for (const L of LEVELS) {
      const li = scored.filter(i => i.level === L);
      if (!li.length) break;
      const passAt = Math.ceil(li.length * 2 / 3);
      if (li.filter(i => i.correct).length >= passAt) s.level = L; else break;
    }
    const reached = LEVELS.filter(L => scored.some(i => i.level === L));
    s.stoppedEarly = reached.length < LEVELS.length;
  }
  return s;
}

// Punkty poziomu: brak = 0, A = 1, B = 2, C = 3.
const LP = { null: 0, A: 1, B: 2, C: 3 };

export function overallLevel(sections) {
  const parts = [];
  for (const k of ['words', 'listening', 'reading', 'spelling']) if (sections[k] && sections[k].n) parts.push(LP[sections[k].level]);
  if (sections.phonics && sections.phonics.n) parts.push(3 * sections.phonics.score);
  const p = mean(parts);
  if (p < 0.75) return 'preA1';
  if (p < 1.4) return 'A1-';
  if (p < 2.0) return 'A1';
  if (p < 2.6) return 'A1+';
  return 'A2';
}

export function buildResult({ profileId, startedAt, finishedAt, context = {}, items = [], breakTaken = false, version = '1.0.0', sectionModes = {} }) {
  const bySection = {};
  items.forEach(it => { (bySection[it.section] = bySection[it.section] || []).push(it); });

  const sections = {};
  for (const key of ['words', 'contrasts', 'phonics', 'reading', 'listening', 'spelling', 'speaking']) {
    const list = bySection[key] || [];
    if (key === 'speaking') {
      const responded = list.filter(i => i.responded).length;
      sections.speaking = { n: list.length, correct: null, score: null, level: null, stoppedEarly: false,
        responded, respondedRate: list.length ? round(responded / list.length) : null,
        avgLatencyMs: Math.round(mean(list.filter(i => i.responded && i.latencyMs != null).map(i => i.latencyMs))) || null };
      continue;
    }
    sections[key] = sectionSummary(list, sectionModes[key] || 'list');
    if (key === 'phonics' && list.length) {
      sections.phonics.stoppedEarly = !!list[list.length - 1].stopRule;
    }
  }

  // Kontrasty: wyniki z części 2 + błędy z części 3 i 6, które na nie wskazują.
  const contrasts = {};
  CONTRAST_PRIORITY.forEach(c => { contrasts[c] = { n: 0, correct: 0, relatedErrors: 0 }; });
  (bySection.contrasts || []).forEach(it => {
    if (!it.contrast || !contrasts[it.contrast]) return;
    contrasts[it.contrast].n++;
    if (it.correct) contrasts[it.contrast].correct++;
  });
  const errorCounts = {};
  items.forEach(it => {
    if (!it.errorType) return;
    errorCounts[it.errorType] = (errorCounts[it.errorType] || 0) + 1;
    const c = ERROR_TO_CONTRAST[it.errorType];
    if (c && contrasts[c]) contrasts[c].relatedErrors++;
  });

  // Uwaga i zmęczenie.
  const timed = items.filter(i => typeof i.rtMs === 'number' && i.section !== 'speaking');
  const rts = timed.map(i => Math.min(i.rtMs, 30000));
  const third = Math.max(1, Math.floor(rts.length / 3));
  const firstRt = mean(rts.slice(0, third)), lastRt = mean(rts.slice(-third));
  const scoredItems = items.filter(i => i.correct === true || i.correct === false);
  const firstAcc = mean(scoredItems.slice(0, Math.max(1, Math.floor(scoredItems.length / 3))).map(i => (i.correct ? 1 : 0)));
  const lastAcc = mean(scoredItems.slice(-Math.max(1, Math.floor(scoredItems.length / 3))).map(i => (i.correct ? 1 : 0)));
  const fatigueFlag = rts.length >= 9 && (lastRt > firstRt * 1.5 || lastAcc < firstAcc - 0.3);
  const attention = {
    avgRtMs: Math.round(mean(rts)) || null,
    rtTrend: round(slope(rts), 0),
    replaysPerItem: round(mean(timed.map(i => i.replays || 0))),
    slowUsageRate: round(mean(timed.map(i => (i.slowUsed ? 1 : 0)))),
    breakTaken: !!breakTaken,
    fatigueFlag
  };

  // Profil: mocne i słabe strony.
  const skillOf = { words: 'listening_vocab', contrasts: 'discrimination', phonics: 'sound_letter', reading: 'reading', listening: 'listening_comprehension', spelling: 'spelling' };
  const strengths = [], weaknesses = [];
  Object.entries(skillOf).forEach(([k, skill]) => {
    const s = sections[k]; if (!s || !s.n) return;
    if (s.score >= 0.8) strengths.push(skill); else if (s.score < 0.6) weaknesses.push(skill);
  });
  if ((errorCounts.polish_phonetic || 0) >= 2 && !weaknesses.includes('sound_letter')) weaknesses.push('sound_letter');

  const weakness = c => (contrasts[c].n - contrasts[c].correct) * 2 + contrasts[c].relatedErrors;
  const weakContrasts = CONTRAST_PRIORITY.filter(c => weakness(c) > 0)
    .sort((a, b) => weakness(b) - weakness(a) || CONTRAST_PRIORITY.indexOf(a) - CONTRAST_PRIORITY.indexOf(b));
  const startSounds = weakContrasts.slice(0, 3);
  for (const c of CONTRAST_PRIORITY) { if (startSounds.length >= 3) break; if (!startSounds.includes(c)) startSounds.push(c); }

  const overall = overallLevel(sections);
  const spellingOk = sections.spelling && sections.spelling.score >= 0.8;
  const plan = {
    startSounds,
    missionMinutes: fatigueFlag ? 5 : 7,
    supports: {
      slowAudioDefault: attention.slowUsageRate > 0.3 || !sections.words || !sections.words.level || overall === 'preA1',
      pictures: true,
      plHint: overall === 'preA1' || overall === 'A1-',
      letterTiles: !spellingOk,
      speakingMode: context.micOk ? 'practice' : 'off'
    },
    focus: [...weaknesses].sort((a, b) => (a === 'discrimination' ? -1 : b === 'discrimination' ? 1 : 0))
  };
  if (!plan.focus.length) plan.focus = ['discrimination'];

  const t0 = new Date(startedAt).getTime(), t1 = new Date(finishedAt).getTime();
  return {
    schema: SCHEMA, version, profileId,
    startedAt, finishedAt, durationSec: Math.round((t1 - t0) / 1000),
    context,
    items,
    sections,
    contrasts,
    errors: errorCounts,
    attention,
    profile: { overall, strengths, weaknesses, weakContrasts },
    plan
  };
}

// Krótki opis po polsku dla rodzica.
const SKILL_PL = {
  listening_vocab: 'rozumienie słów ze słuchu', discrimination: 'rozróżnianie podobnych dźwięków', sound_letter: 'łączenie dźwięku z literą',
  reading: 'czytanie', listening_comprehension: 'rozumienie poleceń', spelling: 'pisanie ze słuchu', speaking: 'mówienie'
};
const CONTRAST_PL = {
  ae_e: 'a/e jak w pan i pen', i_ee: 'krótkie i długie i jak w ship i sheep', t_d_final: 't i d na końcu słowa (cart, card)',
  p_b: 'p i b (pear, bear)', th_s_f: 'th (three, tree, mouth, mouse)', w_v: 'w i v (wet, vet)', h: 'h na początku (heart, art)'
};
const LEVEL_PL = { preA1: 'początkujący (przed A1)', 'A1-': 'początek A1', A1: 'A1', 'A1+': 'mocne A1', A2: 'A2' };

export function describeForParent(r) {
  const lines = [];
  lines.push(`Poziom ogólny: ${LEVEL_PL[r.profile.overall] || r.profile.overall}. Test trwał ${Math.round(r.durationSec / 60)} min.`);
  if (r.profile.strengths.length) lines.push('Mocne strony: ' + r.profile.strengths.map(s => SKILL_PL[s]).join(', ') + '.');
  if (r.profile.weaknesses.length) lines.push('Do ćwiczenia: ' + r.profile.weaknesses.map(s => SKILL_PL[s]).join(', ') + '.');
  if (r.errors.polish_phonetic) lines.push(`Zapis „po polsku” wybrany ${r.errors.polish_phonetic} raz(y), np. syt zamiast sit.`);
  lines.push('Pierwsze dźwięki do nauki: ' + r.plan.startSounds.map(c => CONTRAST_PL[c]).join('; ') + '.');
  if (r.attention.fatigueFlag) lines.push('Pod koniec widać zmęczenie, więc misje będą krótsze (5 minut).');
  if (r.attention.slowUsageRate > 0.3) lines.push('Często używał wolnego tempa, więc gra domyślnie mówi wolniej.');
  if (!r.context.micOk) lines.push('Mikrofon nie działał albo nie dostał zgody, więc mówienie pominięto.');
  return lines.join('\n');
}
