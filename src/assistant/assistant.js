/*
 * RGAssistant: lokalny analityk postępów dla Roboguardian English Quest.
 * Działa w przeglądarce, bez serwera, bez kluczy i bez zależności (moduł ES, ustawia też window.RGAssistant).
 *
 * API:
 *   record(profile, event)               zapisuje jedną odpowiedź dziecka
 *   nextSettings(profile, missionId|opts) ustawienia trudności dla następnej rundy
 *   pickItems(profile, pool, n, opts)    dobór słówek: powtórki + nowe
 *   getDifficulty(profile, missionId)    {level 1|2|3, focusItems, skipItems, slowAudioDefault, maxChoices}
 *   importCalibration(profile, result)   wynik testu startowego (roboguardian.calibration/1) ustawia poziomy
 *   setLevel(profile, skill, lvl)        ręczne ustawienie poziomu 1–5
 *   analyze(profile)                     problemy, mocne strony, plan (dane)
 *   report(profile, {name})              gotowy tekst po polsku dla rodzica
 *   claudePrompt(profile, {age})         tekst do wklejenia we własnym Claude rodzica
 *
 * Dane trzymane są tylko w profile.assistant. Zapis do localStorage robi rdzeń gry.
 */
const RGAssistant = (function (root) {
  'use strict';

  var VERSION = 1;
  var LOG_MAX = 3000;
  var MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  // Odstępy powtórek dla pudełek Leitnera 0..5
  var BOX_INTERVALS = [0, 10 * MIN, 1 * DAY, 3 * DAY, 7 * DAY, 21 * DAY];
  var MASTERED_BOX = 4;
  var LVL_MIN = 1, LVL_MAX = 5, LVL_START = 2;
  var FAST_MS = 1500;         // szybciej niż to i źle = podejrzenie zgadywania

  var SKILLS = {
    'vocab':           { name: 'słownictwo', tip: 'Przy codziennych czynnościach nazywajcie po angielsku 3–5 przedmiotów z gry (np. przy ubieraniu: jacket, shoes, hat).' },
    'listening':       { name: 'rozumienie ze słuchu', tip: 'Puszczajcie słówko lektora bez patrzenia na ekran i niech dziecko pokaże obrazek. Krótko, 3 minuty dziennie.' },
    'reading':         { name: 'czytanie', tip: 'Karteczki ze słówkami na przedmiotach w domu: dziecko czyta i dotyka przedmiotu.' },
    'spelling':        { name: 'pisownia', tip: 'Literowanie na głos 2–3 słówek dziennie, potem ułożenie ich z rozsypanych liter i zapis z pamięci.' },
    'phoneme':         { name: 'rozróżnianie dźwięków', tip: 'Zabawa „podobne czy różne?”: rodzic mówi dwa słowa (ship/sheep, bed/bad), dziecko pokazuje kciuk w górę albo w bok.' },
    'letter':          { name: 'litery i ich dźwięki', tip: 'Szukanie w domu rzeczy na daną głoskę (nie literę!): „coś na /b/” – ball, book, bed.' },
    'phrase':          { name: 'zwroty i zdania', tip: 'Jedno zdanie dnia z gry używane naprawdę w domu, np. „Can I have…, please?” przy stole.' },
    'grammar':         { name: 'gramatyka', tip: 'Jedna zasada naraz, 5 minut, zawsze z przykładem z życia dziecka.' },
    'grammar.is_are':  { name: 'is / are', tip: 'Zabawa przy stole: jedna rzecz to „is”, kilka to „are” (The cup is… / The cups are…). Rodzic pokazuje, dziecko mówi.' },
    'grammar.his_her': { name: 'his / her', tip: 'Zdjęcia rodziny: „his” o chłopcu lub mężczyźnie, „her” o dziewczynce lub kobiecie. Najpierw pytanie „chłopiec czy dziewczynka?”, potem wybór.' },
    'grammar.he_she':  { name: 'he / she', tip: 'Ta sama zasada co po polsku on/ona. Krótkie zdania o członkach rodziny: „Mum? She…”, „Dad? He…”.' },
    'time':            { name: 'godziny', tip: 'Zegar ze wskazówkami: rodzic ustawia, dziecko mówi godzinę po angielsku (najpierw pełne, potem „half past”, na końcu kwadranse).' },
    'phoneme.cmd':     { name: 'rozumienie poleceń', tip: 'Zabawa „Simon says”: rodzic wydaje krótkie polecenia po angielsku (stand up, touch your nose), dziecko je wykonuje.' },
    'phoneme.talk':    { name: 'rozmowa', tip: 'Codziennie jedna krótka wymiana zdań po angielsku, np. „How are you?” – „I am fine, thank you”.' },
    'dialog':          { name: 'rozmowa', tip: 'Codziennie jedna krótka wymiana zdań po angielsku, np. „How are you?” – „I am fine, thank you”.' },
    'speaking':        { name: 'mówienie', tip: 'Dziecko powtarza za lektorem i nagrywa się telefonem, potem razem słuchacie. Chwalimy próbę, nie poprawiamy każdego dźwięku.' }
  };
  // inne nazwy tych samych umiejętności (misje, test startowy)
  var SKILL_ALIAS = { ear: 'phoneme', contrasts: 'phoneme', phonics: 'letter', words: 'vocab', read: 'reading', spell: 'spelling', speak: 'speaking' };
  // dźwięki trudne dla polskich dzieci; klucze kanoniczne + aliasy z testu startowego
  var SOUNDS = {
    ae: 'æ / e (bad – bed)', ih: 'ɪ / iː (ship – sheep)', td: 't / d na końcu (cat – cad)', pb: 'p / b (pig – big)',
    th: 'th (think, this)', wv: 'w / v (wine – vine)', wh: 'w na początku (what, where)', h: 'h na początku (hat – at)',
    onset: 'pierwsza głoska słowa', vowels: 'samogłoski', mix: 'różne dźwięki'
  };
  var SOUND_ALIAS = { ae_e: 'ae', i_ee: 'ih', t_d_final: 'td', p_b: 'pb', th_s_f: 'th', w_v: 'wv' };
  var SOUND_TIP = 'Dźwięki, których nie ma w polskim, ćwiczcie parami: rodzic mówi jedno słowo z pary, dziecko pokazuje obrazek. 2 minuty dziennie, z przesadną wymową. Lustro pomaga (np. przy th język między zębami).';
  var ERROR_TYPES = {
    polish_phonetic: 'zapis „po polsku” (tak, jak się słyszy)', voicing_t_d: 'mylenie t i d', vowel_ae_e: 'mylenie æ i e',
    vowel_i_ee: 'mylenie krótkiego i długiego i', initial_consonant: 'zła pierwsza głoska', th: 'dźwięk th', w_v: 'mylenie w i v',
    h_drop: 'gubienie h', letter_order: 'kolejność liter', missing_letter: 'brakujące litery',
    vowel_i_e: 'mylenie i oraz e', voicing_p_b: 'mylenie p i b'
  };
  // typy błędów zbyt ogólne, by robić z nich osobny problem (pokrywa je analiza umiejętności)
  var GENERIC_ERRORS = { other: 1, vocab: 1, reading: 1, comprehension: 1 };
  function errorName(k) {
    if (ERROR_TYPES[k]) return ERROR_TYPES[k];
    var m = /^contrast_(.+)$/.exec(k);
    if (m) { var key = SOUND_ALIAS[m[1]] || m[1]; return 'pary dźwięków ' + (SOUNDS[key] || m[1]); }
    return k;
  }
  var SPELL_ERRORS = { polish_phonetic: 1, letter_order: 1, missing_letter: 1 };

  // ---------- pomocnicze ----------
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function round(x, d) { var p = Math.pow(10, d || 0); return Math.round(x * p) / p; }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function now(opts) { return (opts && opts.now) || Date.now(); }
  function skillInfo(s) {
    var parts = String(s).split('.');
    if (parts[1] && SOUNDS[parts[1]]) return { name: SKILLS[parts[0]] ? SKILLS[parts[0]].name + ': ' + SOUNDS[parts[1]] : SOUNDS[parts[1]], tip: SOUND_TIP };
    if (SKILLS[s]) return SKILLS[s];
    if (SKILLS[parts[0]]) return { name: SKILLS[parts[0]].name + (parts[1] ? ' (' + parts[1].replace(/_/g, '/') + ')' : ''), tip: SKILLS[parts[0]].tip };
    return { name: s, tip: '' };
  }
  function skillName(s) { return skillInfo(s).name; }
  function skillTip(s) { return skillInfo(s).tip; }

  function state(profile) {
    var pa = profile.assistant;
    if (!pa || pa.v !== VERSION || !pa.items) {
      // rdzeń dopisuje surowe zdarzenia do profile.assistant.log, gdy asystent nie był wczytany
      var old = pa && Array.isArray(pa.log) ? pa.log.slice() : [];
      profile.assistant = { v: VERSION, log: [], items: {}, skills: {}, level: { overall: LVL_START, skills: {} }, sessions: {} };
      old.sort(function (a, b) { return (a.t || a.ts || 0) - (b.t || b.ts || 0); });
      old.forEach(function (e) { record(profile, e); });
    }
    return profile.assistant;
  }

  function skillLevel(st, skill) {
    if (typeof st.level.skills[skill] === 'number') return st.level.skills[skill];
    var base = String(skill).split('.')[0];
    if (typeof st.level.skills[base] === 'number') return st.level.skills[base];
    return st.level.overall;
  }

  // ---------- zapis zdarzenia ----------
  // Przyjmuje format z docs/ARCHITEKTURA.md {t,session,mission,item,skill,mode,ok,ms,opts,hint,chosen,level},
  // format misji {ts,missionId,itemId,skill,target,correct,attempts,ms,replays,slowUsed,hintShown}
  // i pozycje testu startowego {id,skill,contrast,correct,rtMs,answer,errorType,replays,slowUsed}.
  var DEFAULT_MODE = { phoneme: 'listen', listening: 'listen', letter: 'listen', reading: 'read', spelling: 'type', speaking: 'speak' };
  function normalize(ev) {
    var parts = String(ev.skill || 'vocab').split('.');
    if (SKILL_ALIAS[parts[0]]) parts[0] = SKILL_ALIAS[parts[0]];
    var target = ev.target || ev.contrast || null;
    if (!parts[1] && target && (SOUNDS[target] || SOUND_ALIAS[target])) parts[1] = target;
    if (parts[1] && SOUND_ALIAS[parts[1]]) parts[1] = SOUND_ALIAS[parts[1]];
    var skill = parts.join('.');
    var correct = ev.ok != null ? ev.ok : ev.correct;
    var attempts = typeof ev.attempts === 'number' ? ev.attempts : 1;
    var t = ev.t || ev.ts || Date.now();
    if (typeof t === 'string') t = Date.parse(t) || Date.now();
    var chosen = ev.chosen != null ? ev.chosen : (!correct && ev.answer != null && typeof ev.answer !== 'object' ? ev.answer : null);
    return {
      t: t,
      session: ev.session || ev.sessionId || ((ev.mission || ev.missionId || 'x') + '@' + new Date(t).toDateString()),
      mission: ev.mission || ev.missionId || '',
      item: String(ev.item || ev.itemId || ev.id || ''),
      skill: skill,
      mode: ev.mode || DEFAULT_MODE[parts[0]] || 'choose',
      ok: !!correct && attempts <= 1,            // liczy się odpowiedź za pierwszym razem
      ms: typeof ev.ms === 'number' ? ev.ms : typeof ev.rtMs === 'number' ? ev.rtMs : null,
      opts: typeof ev.opts === 'number' ? ev.opts : ev.shown ? ev.shown.length : null,
      hint: !!(ev.hint || ev.hintShown),
      replays: ev.replays || 0,
      slow: !!ev.slowUsed,
      chosen: chosen == null ? null : String(chosen),
      err: ev.errorType || ev.err || null,
      level: typeof ev.level === 'number' ? ev.level : null
    };
  }

  function record(profile, ev) {
    var st = state(profile);
    var e = normalize(ev);
    st.log.push(e);
    if (st.log.length > LOG_MAX) st.log.splice(0, st.log.length - LOG_MAX);

    // słówko / element
    if (e.item) {
      var it = st.items[e.item] || (st.items[e.item] = { skill: e.skill, box: 0, seen: 0, ok: 0, wrong: 0, streak: 0, last: 0, due: 0, confusions: {} });
      it.seen++; it.last = e.t;
      if (e.ok) {
        it.ok++; it.streak++;
        var cap = e.hint ? 2 : 5;               // z polską podpowiedzią słowo nie idzie wyżej niż pudełko 2
        if (it.box < cap) it.box++;
      } else {
        it.wrong++; it.streak = 0;
        it.box = Math.max(0, Math.min(it.box - 2, 1));
        if (e.chosen && e.chosen !== e.item) it.confusions[e.chosen] = (it.confusions[e.chosen] || 0) + 1;
      }
      it.due = e.t + BOX_INTERVALS[it.box];
    }

    // umiejętność
    var sk = st.skills[e.skill] || (st.skills[e.skill] = { n: 0, ok: 0, ewma: null, msAvg: null, hints: 0, fastWrong: 0, modes: {}, errors: {} });
    sk.n++; if (e.ok) sk.ok++;
    sk.ewma = sk.ewma == null ? (e.ok ? 1 : 0) : sk.ewma * 0.85 + (e.ok ? 1 : 0) * 0.15;
    if (e.ms != null) sk.msAvg = sk.msAvg == null ? e.ms : sk.msAvg * 0.85 + e.ms * 0.15;
    if (e.hint) sk.hints++;
    if (!e.ok && e.ms != null && e.ms < FAST_MS) sk.fastWrong++;
    if (e.err) sk.errors[e.err] = (sk.errors[e.err] || 0) + 1;
    var m = sk.modes[e.mode] || (sk.modes[e.mode] = { n: 0, ok: 0 });
    m.n++; if (e.ok) m.ok++;

    // poziom: cel ok. 80% dobrych odpowiedzi.
    // dobra +0.04, zła -0.16 (równowaga przy 80%), z podpowiedzią mniejsza nagroda.
    var delta = e.ok ? (e.hint ? 0.015 : 0.04) : -0.16;
    st.level.skills[e.skill] = round(clamp(skillLevel(st, e.skill) + delta, LVL_MIN, LVL_MAX), 3);
    st.level.overall = round(overallLevel(st), 3);

    // sesja
    var se = st.sessions[e.session] || (st.sessions[e.session] = { start: e.t, end: e.t, n: 0, ok: 0 });
    se.end = Math.max(se.end, e.t); se.start = Math.min(se.start, e.t); se.n++; if (e.ok) se.ok++;
    var keys = Object.keys(st.sessions);
    if (keys.length > 200) {
      keys.sort(function (a, b) { return st.sessions[a].start - st.sessions[b].start; });
      for (var i = 0; i < keys.length - 200; i++) delete st.sessions[keys[i]];
    }
    return e;
  }

  // Poziom ogólny = średnia poziomów umiejętności ważona liczbą pytań (min. 5, maks. 60).
  // Zanim są dane, zostaje poziom startowy (np. z testu startowego).
  function overallLevel(st) {
    var sum = 0, w = 0;
    Object.keys(st.level.skills).forEach(function (k) {
      var sk = st.skills[k]; var n = sk ? sk.n : 0;
      if (n < 5) return;
      var wt = Math.min(60, n); sum += st.level.skills[k] * wt; w += wt;
    });
    if (!w) return st.level.base != null ? st.level.base : st.level.overall;
    var base = st.level.base != null ? st.level.base : null;
    // przy małej liczbie danych mieszamy z poziomem startowym
    if (base != null && w < 60) return (sum + base * (60 - w)) / 60;
    return sum / w;
  }

  function setLevel(profile, skill, lvl) {
    var st = state(profile);
    lvl = clamp(lvl, LVL_MIN, LVL_MAX);
    if (!skill || skill === 'overall') { st.level.overall = lvl; st.level.base = lvl; } else st.level.skills[skill] = lvl;
  }

  // ---------- trudność ----------
  // Zmęczenie: sesja trwa ponad 15 min i ostatnie 8 odpowiedzi są wyraźnie gorsze niż wcześniejsze.
  function fatigue(st, session, t) {
    var se = st.sessions[session];
    if (!se) return { tired: false, minutes: 0 };
    var minutes = (t - se.start) / MIN;
    var evs = st.log.filter(function (e) { return e.session === session; });
    if (evs.length < 16) return { tired: false, minutes: minutes };
    var last = evs.slice(-8), before = evs.slice(0, -8);
    var accL = last.filter(function (e) { return e.ok; }).length / last.length;
    var accB = before.filter(function (e) { return e.ok; }).length / before.length;
    return { tired: minutes > 15 && accB - accL >= 0.25, minutes: minutes, drop: accB - accL };
  }

  // Główna umiejętność misji: najczęstsza w jej ostatnich zdarzeniach.
  function missionSkill(st, mission) {
    var c = {}, best = null;
    for (var i = st.log.length - 1, k = 0; i >= 0 && k < 300; i--) {
      var e = st.log[i]; if (e.mission !== mission) continue; k++;
      c[e.skill] = (c[e.skill] || 0) + 1; if (!best || c[e.skill] > c[best]) best = e.skill;
    }
    return best;
  }

  function nextSettings(profile, opts) {
    if (typeof opts === 'string') opts = { mission: opts };
    opts = opts || {};
    var st = state(profile), t = now(opts);
    var skill = opts.skill || (opts.mission && missionSkill(st, opts.mission));
    var session = opts.session;
    if (!session && st.log.length && t - st.log[st.log.length - 1].t < 30 * MIN) session = st.log[st.log.length - 1].session;
    var lvl = skill ? skillLevel(st, skill) : st.level.overall;
    var f = session ? fatigue(st, session, t) : { tired: false };
    if (f.tired) lvl = Math.max(LVL_MIN, lvl - 0.7);
    var x = (lvl - LVL_MIN) / (LVL_MAX - LVL_MIN); // 0..1
    var options = lvl < 2 ? 2 : lvl < 3.5 ? 3 : 4;
    var polishHint = lvl < 2.5 ? 'always' : lvl < 3.8 ? 'after-wrong' : 'never';
    return {
      level: round(lvl, 2),
      speed: round(0.6 + x * 0.7, 2),            // mnożnik tempa (spadanie, animacje): 0.6..1.3
      options: options, opts: options,           // liczba odpowiedzi do wyboru
      polishHint: polishHint, plHint: polishHint !== 'never',
      newPerRound: lvl < 2 ? 1 : lvl < 3 ? 2 : lvl < 4 ? 3 : 4,
      replayAudio: lvl < 3,                      // automatyczna powtórka nagrania po błędzie
      slowAudio: lvl < 1.8,
      suggestBreak: !!f.tired,
      message: f.tired ? 'Systems need a short recharge. Take a 5-minute break, Guardian!' : null,
      messagePl: f.tired ? 'Moje systemy potrzebują krótkiej przerwy. Odpocznij 5 minut, Strażniku!' : null
    };
  }

  // ---------- dobór słówek ----------
  // pool: tablica id albo obiektów z polem id. Zwraca do n elementów puli (te same obiekty).
  function pickItems(profile, pool, n, opts) {
    if (typeof opts === 'string') opts = { mission: opts };
    opts = opts || {};
    var st = state(profile), t = now(opts);
    var set = nextSettings(profile, opts);
    var ids = pool.map(function (p) { return typeof p === 'object' ? String(p.id) : String(p); });
    var byId = {}; pool.forEach(function (p, i) { byId[ids[i]] = p; });
    var due = [], learning = [], fresh = [], mastered = [];
    ids.forEach(function (id) {
      var it = st.items[id];
      if (!it) fresh.push(id);
      else if (it.box >= MASTERED_BOX && it.due > t) mastered.push(id);
      else if (it.due <= t) due.push(id);
      else learning.push(id);
    });
    due.sort(function (a, b) { return st.items[a].box - st.items[b].box || st.items[a].due - st.items[b].due; });
    learning.sort(function (a, b) { return st.items[a].due - st.items[b].due; });
    var out = [];
    function take(list, k) { while (k-- > 0 && list.length && out.length < n) out.push(list.shift()); }
    take(fresh, set.newPerRound);   // kilka nowych (ile – zależy od poziomu)
    take(mastered, 1);              // jedno pewne słowo dla pewności siebie
    take(due, n);                   // powtórki, najsłabsze najpierw
    take(learning, n);
    take(fresh, n);                 // brak powtórek: więcej nowych
    take(mastered, n);
    for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = out[i]; out[i] = out[j]; out[j] = tmp; }
    return out.map(function (id) { return byId[id]; });
  }

  // Kontrakt misji rozdziału 1.
  function getDifficulty(profile, missionId, opts) {
    opts = opts || {};
    var st = state(profile), t = now(opts);
    var set = nextSettings(profile, { mission: missionId, skill: opts.skill, session: opts.session, now: opts.now });
    var lvl = set.level;
    var seen = {};
    st.log.forEach(function (e) { if (e.mission === missionId && e.item) seen[e.item] = 1; });
    var ids = opts.items || Object.keys(seen);
    var focus = ids.filter(function (id) { var it = st.items[id]; return it && it.box <= 1 && it.wrong > 0; })
      .sort(function (a, b) { return st.items[b].wrong - st.items[a].wrong; });
    var skip = ids.filter(function (id) { var it = st.items[id]; return it && it.box >= 5 && it.due > t; });
    var sup = st.calibration && st.calibration.plan && st.calibration.plan.supports;
    return {
      level: lvl < 2.3 ? 1 : lvl < 3.6 ? 2 : 3,
      focusItems: focus.slice(0, 6),
      skipItems: skip,
      slowAudioDefault: set.slowAudio || !!(sup && sup.slowAudioDefault && lvl < 2.8),
      maxChoices: set.options,
      polishHint: set.polishHint,
      speed: set.speed,
      suggestBreak: set.suggestBreak
    };
  }

  // Wynik testu startowego (schemat roboguardian.calibration/1) ustawia poziomy startowe.
  var CEFR_LEVEL = { 'preA1': 1.3, 'A1-': 1.8, 'A1': 2.3, 'A1+': 3.0, 'A2': 3.7 };
  function importCalibration(profile, c) {
    if (!c) return;
    var st = state(profile);
    if (st.calibration && st.calibration.at === (c.finishedAt || null)) return; // już zaimportowany
    // test mógł już wołać record() w trakcie (mission 'calibration'): wtedy nie liczymy items[] drugi raz
    var already = st.log.some(function (e) { return e.mission === 'calibration'; });
    (already ? [] : c.items || []).forEach(function (it) {
      var ev = {}; for (var k in it) ev[k] = it[k];
      ev.session = 'calibration'; ev.mission = 'calibration';
      ev.t = ev.t || c.finishedAt || Date.now();
      delete ev.level; // poziomy A/B/C testu to inna skala niż 1–5
      record(profile, ev);
    });
    var overall = CEFR_LEVEL[c.profile && c.profile.overall] || st.level.overall;
    st.level.overall = overall; st.level.base = overall;
    var secs = c.sections || {};
    Object.keys(secs).forEach(function (k) {
      var sec = secs[k]; if (!sec || !sec.n || typeof sec.score !== 'number') return;
      // wynik sekcji przesuwa poziom umiejętności o maks. ±1 względem ogólnego
      st.level.skills[SKILL_ALIAS[k] || k] = round(clamp(overall + (sec.score - 0.7) * 2, LVL_MIN, LVL_MAX), 2);
    });
    var cons = c.contrasts || {};
    Object.keys(cons).forEach(function (k) {
      var x = cons[k]; if (!x || !x.n) return;
      st.level.skills['phoneme.' + (SOUND_ALIAS[k] || k)] = round(clamp(overall + (x.correct / x.n - 0.7) * 2, LVL_MIN, LVL_MAX), 2);
    });
    st.calibration = { at: c.finishedAt || null, durationSec: c.durationSec, context: c.context || {}, sections: secs,
      contrasts: cons, attention: c.attention || {}, profile: c.profile || {}, plan: c.plan || {} };
  }

  // ---------- analiza ----------
  function analyze(profile, opts) {
    var st = state(profile), t = now(opts);
    if (profile.calibration && !st.calibration) importCalibration(profile, profile.calibration);
    var problems = [], strengths = [];
    var log = st.log.filter(function (e) { return e.session !== 'calibration'; });
    var total = log.length;
    var correct = log.filter(function (e) { return e.ok; }).length;

    // 1. słabe umiejętności (i mocne strony)
    Object.keys(st.skills).forEach(function (s) {
      var sk = st.skills[s];
      if (sk.n >= 8 && sk.ewma < 0.6) {
        problems.push({ id: 'weak:' + s, severity: sk.ewma < 0.45 ? 3 : 2, skill: s,
          title: 'Trudność: ' + skillName(s),
          evidence: 'Ostatnio ' + pct(sk.ewma) + ' dobrych odpowiedzi (' + sk.n + ' pytań łącznie).',
          action: skillTip(s),
          game: 'Gra sama zwolniła tempo i zmniejszyła liczbę odpowiedzi w tej umiejętności.' });
      } else if (sk.n >= 15 && sk.ewma >= 0.9) {
        strengths.push({ skill: s, text: skillName(s) + ': ' + pct(sk.ewma) + ' dobrych odpowiedzi' });
      }
    });

    // 2. pomyłki w parach (np. wybiera „his” zamiast „her”)
    var conf = {};
    Object.keys(st.items).forEach(function (id) {
      var it = st.items[id];
      Object.keys(it.confusions).forEach(function (c) {
        var key = [id, c].sort().join('|');
        conf[key] = conf[key] || { key: key, a: id, b: c, n: 0, skill: it.skill };
        conf[key].n += it.confusions[c];
      });
    });
    Object.keys(conf).map(function (k) { return conf[k]; })
      .filter(function (c) {
        // systematyczna pomyłka: min. 3 razy, większość błędów w tych słowach i min. 20% ich pokazań
        var A_ = st.items[c.a], B_ = st.items[c.b] || { wrong: 0, seen: 0 };
        var wrong = A_.wrong + B_.wrong, seen = A_.seen + B_.seen;
        return c.n >= 3 && c.n / wrong >= 0.4 && c.n / seen >= 0.2;
      })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 3)
      .forEach(function (c) {
        problems.push({ id: 'confuse:' + c.key, severity: c.n >= 6 ? 3 : 2, skill: c.skill,
          title: 'Myli „' + c.a + '” z „' + c.b + '”',
          evidence: 'Ta pomyłka powtórzyła się ' + c.n + ' razy.',
          action: 'Pokażcie obie rzeczy obok siebie i nazwijcie różnicę po polsku. ' + skillTip(c.skill),
          game: 'Gra częściej daje te dwa słowa obok siebie, z polską podpowiedzią.' });
      });

    // 3. typowe błędy (np. zapis „po polsku”)
    var errs = {};
    Object.keys(st.skills).forEach(function (sk) { var e = st.skills[sk].errors || {}; Object.keys(e).forEach(function (k) { errs[k] = (errs[k] || 0) + e[k]; }); });
    Object.keys(errs).filter(function (k) { return !GENERIC_ERRORS[k] && errs[k] >= 3; })
      .sort(function (a, b) { return errs[b] - errs[a]; }).slice(0, 2)
      .forEach(function (k) {
        problems.push({ id: 'error:' + k, severity: errs[k] >= 6 ? 2 : 1,
          title: 'Powtarzający się błąd: ' + errorName(k),
          evidence: errs[k] + ' razy.',
          action: SPELL_ERRORS[k] ? SKILLS.spelling.tip : SOUND_TIP,
          game: 'Gra dobiera więcej ćwiczeń na ten typ błędu.' });
      });

    // 4. słuchanie wyraźnie słabsze niż czytanie (lub odwrotnie)
    var modeAcc = {};
    log.forEach(function (e) { var m = modeAcc[e.mode] || (modeAcc[e.mode] = { n: 0, ok: 0 }); m.n++; if (e.ok) m.ok++; });
    function acc(m) { return m && m.n >= 10 ? m.ok / m.n : null; }
    var aL = acc(modeAcc.listen), aR = acc(modeAcc.read);
    if (aL != null && aR != null && aR - aL >= 0.2) {
      problems.push({ id: 'listen-gap', severity: 2, skill: 'listening',
        title: 'Słuchanie słabsze niż czytanie',
        evidence: 'Ze słuchu ' + pct(aL) + ', z czytania ' + pct(aR) + '.',
        action: SKILLS.listening.tip + ' Sprawdźcie też głośność i słuchawki.',
        game: 'Gra częściej powtarza nagranie i dodaje pytania tylko ze słuchu.' });
    } else if (aL != null && aR != null && aL - aR >= 0.2) {
      problems.push({ id: 'read-gap', severity: 2, skill: 'reading',
        title: 'Czytanie słabsze niż słuchanie',
        evidence: 'Z czytania ' + pct(aR) + ', ze słuchu ' + pct(aL) + '.',
        action: SKILLS.reading.tip,
        game: 'Gra pokazuje napis razem z nagraniem.' });
    }

    // 5. zgadywanie
    var wrongTimed = log.filter(function (e) { return !e.ok && e.ms != null; });
    var fastWrong = wrongTimed.filter(function (e) { return e.ms < FAST_MS; }).length;
    if (wrongTimed.length >= 10 && fastWrong / wrongTimed.length >= 0.4) {
      problems.push({ id: 'guessing', severity: 2,
        title: 'Klika za szybko (zgaduje)',
        evidence: pct(fastWrong / wrongTimed.length) + ' błędów to kliknięcia w mniej niż 1,5 sekundy.',
        action: 'Umówcie się na zasadę „najpierw posłuchaj do końca, potem klikaj”. Chwalcie spokojne odpowiedzi, nie szybkość.',
        game: 'Gra blokuje odpowiedzi do końca nagrania.' });
    }

    // 6. zmęczenie w sesjach
    var tiredSessions = 0, lens = [];
    var bySession = {};
    log.forEach(function (e) { (bySession[e.session] = bySession[e.session] || []).push(e); });
    Object.keys(bySession).forEach(function (sid) {
      var evs = bySession[sid];
      lens.push((evs[evs.length - 1].t - evs[0].t) / MIN);
      if (evs.length < 15) return;
      var third = Math.floor(evs.length / 3);
      var a1 = evs.slice(0, third).filter(function (e) { return e.ok; }).length / third;
      var a3 = evs.slice(-third).filter(function (e) { return e.ok; }).length / third;
      if (a1 - a3 >= 0.2) tiredSessions++;
    });
    if (tiredSessions >= 2) {
      problems.push({ id: 'fatigue', severity: 2,
        title: 'Pod koniec gry spada skupienie',
        evidence: 'W ' + tiredSessions + ' sesjach wyniki pod koniec były wyraźnie gorsze niż na początku.',
        action: 'Lepsze są krótsze sesje (10–15 minut) częściej niż jedna długa. Dobra pora: zanim dziecko się zmęczy, nie późnym wieczorem.',
        game: 'AEGIS-7 proponuje przerwę, gdy wyniki zaczynają spadać.' });
    }

    // 7. zależność od polskich podpowiedzi
    var withHint = log.filter(function (e) { return e.hint; }).length;
    if (total >= 30 && withHint / total >= 0.5) {
      problems.push({ id: 'hints', severity: 1,
        title: 'Często korzysta z polskiej podpowiedzi',
        evidence: 'Podpowiedź przy ' + pct(withHint / total) + ' pytań.',
        action: 'Na początku to normalne. Zachęcajcie do pierwszej próby bez podpowiedzi, a podpowiedź traktujcie jak koło ratunkowe.',
        game: 'Gdy poziom wzrośnie, gra pokaże podpowiedź dopiero po pierwszym błędzie.' });
    }

    // 8. uparte słowa
    var stubborn = Object.keys(st.items).filter(function (id) { var it = st.items[id]; return it.wrong >= 3 && it.box <= 1; })
      .sort(function (a, b) { return st.items[b].wrong - st.items[a].wrong; });
    if (stubborn.length) {
      problems.push({ id: 'stubborn', severity: stubborn.length >= 5 ? 2 : 1,
        title: 'Słowa, które nie chcą wejść do głowy',
        evidence: stubborn.slice(0, 8).join(', ') + '.',
        list: stubborn.slice(0, 8),
        action: 'Wybierzcie 2–3 z nich na ten tydzień: obrazek, gest i zdanie o dziecku (np. „My jacket is blue”). Lepiej mało, ale codziennie.',
        game: 'Gra powtarza je częściej, aż zostaną zapamiętane.' });
    }

    // 9. regularność
    var lastT = total ? log[total - 1].t : 0;
    var daysSince = total ? (t - lastT) / DAY : null;
    var days7 = {};
    log.forEach(function (e) { if (t - e.t <= 7 * DAY) days7[new Date(e.t).toDateString()] = 1; });
    var activeDays = Object.keys(days7).length;
    if (total && daysSince >= 3) {
      problems.push({ id: 'pause', severity: daysSince >= 7 ? 2 : 1,
        title: 'Przerwa w nauce',
        evidence: 'Ostatnia gra ' + Math.floor(daysSince) + ' dni temu.',
        action: 'Krótka misja codziennie daje więcej niż długa raz w tygodniu. Pomaga stała pora, np. po obiedzie.',
        game: 'Po powrocie gra zaczyna od powtórek, żeby było łatwo i miło.' });
    }

    // mocne strony
    var masteredIds = Object.keys(st.items).filter(function (id) { return st.items[id].box >= MASTERED_BOX; });
    if (masteredIds.length) strengths.push({ text: 'Zapamiętane słowa: ' + masteredIds.length + ' (np. ' + masteredIds.slice(-6).join(', ') + ')' });
    if (activeDays >= 4) strengths.push({ text: 'Regularność: ' + activeDays + ' dni nauki w ostatnim tygodniu' });

    problems.sort(function (a, b) { return b.severity - a.severity; });

    // plan na tydzień: najwyżej 3 rzeczy
    // bez powtórzeń: jedna rada na tę samą wskazówkę (np. kilka par trudnych dźwięków)
    var plan = [], planTips = {};
    problems.forEach(function (p) {
      if (plan.length >= 3) return;
      var key = p.skill ? skillTip(p.skill) : p.id;
      if (planTips[key]) return;
      planTips[key] = 1;
      plan.push(p.action);
    });
    if (!plan.length && total) plan.push('Wszystko idzie dobrze. Grajcie dalej 10–15 minut dziennie, gra sama podnosi poziom.');

    var lvlSkills = {};
    Object.keys(st.level.skills).forEach(function (s) { lvlSkills[s] = round(st.level.skills[s], 1); });
    var lensSorted = lens.slice().sort(function (a, b) { return a - b; });

    return {
      stats: {
        answers: total,
        accuracy: total ? round(correct / total, 2) : null,
        sessions: Object.keys(bySession).length,
        activeDays7: activeDays,
        daysSinceLast: daysSince == null ? null : round(daysSince, 1),
        medianSessionMin: lensSorted.length ? Math.max(1, round(lensSorted[Math.floor(lensSorted.length / 2)], 0)) : null,
        itemsSeen: Object.keys(st.items).length,
        itemsMastered: masteredIds.length,
        level: round(st.level.overall, 1),
        levels: lvlSkills,
        skills: Object.keys(st.skills).map(function (s) {
          var sk = st.skills[s];
          return { skill: s, name: skillName(s), n: sk.n, recent: round(sk.ewma, 2), total: round(sk.ok / sk.n, 2), level: lvlSkills[s] };
        })
      },
      problems: problems,
      strengths: strengths,
      plan: plan
    };
  }

  // ---------- raporty ----------
  var LEVEL_NAMES = ['', 'start', 'podstawy', 'rozwój', 'pewność', 'mistrz'];
  function levelName(l) { return LEVEL_NAMES[clamp(Math.floor(l), 1, 5)]; }

  function report(profile, opts) {
    opts = opts || {};
    var a = analyze(profile, opts), s = a.stats;
    var name = opts.name || profile.name || 'Dziecko';
    if (!s.answers) return { text: name + ': brak wyników. Raport pojawi się po pierwszej misji.', analysis: a };
    var L = [];
    L.push('Raport AEGIS-7: ' + name);
    L.push('');
    L.push('Poziom: ' + s.level + ' z 5 (' + levelName(s.level) + '). Odpowiedzi: ' + s.answers + ', dobrych za pierwszym razem: ' + pct(s.accuracy) + '.');
    L.push('Zapamiętane słowa: ' + s.itemsMastered + ' z ' + s.itemsSeen + ' poznanych. Dni nauki w ostatnim tygodniu: ' + s.activeDays7 + '.');
    if (s.medianSessionMin != null) L.push('Typowa sesja: ok. ' + s.medianSessionMin + ' min.');
    L.push('');
    if (a.strengths.length) {
      L.push('Co idzie dobrze:');
      a.strengths.forEach(function (x) { L.push('• ' + x.text); });
      L.push('');
    }
    if (a.problems.length) {
      L.push('Na co zwrócić uwagę:');
      a.problems.forEach(function (p) {
        L.push('• ' + p.title + '. ' + p.evidence);
        L.push('  Co możecie zrobić: ' + p.action);
        if (p.game) L.push('  Co robi gra: ' + p.game);
      });
      L.push('');
    }
    L.push('Plan na ten tydzień:');
    a.plan.forEach(function (x, i) { L.push((i + 1) + '. ' + x); });
    return { text: L.join('\n'), analysis: a };
  }

  // Tekst do wklejenia we własnym Claude rodzica. Bez imienia dziecka.
  function claudePrompt(profile, opts) {
    opts = opts || {};
    var a = analyze(profile, opts), s = a.stats, st = state(profile);
    var ctxAge = opts.age || (st.calibration && st.calibration.context && st.calibration.context.age);
    var age = ctxAge ? ctxAge + ' lat' : 'wiek nieznany';
    var lines = [];
    lines.push('Jesteś doświadczonym nauczycielem angielskiego dla dzieci. Moje dziecko (' + age + ', język ojczysty polski) uczy się angielskiego w grze edukacyjnej Roboguardian English Quest.');
    lines.push('Poniżej są dane z gry. Przeanalizuj je i odpowiedz po polsku, prosto i konkretnie:');
    lines.push('1) Jakie są 2–3 główne trudności i ich prawdopodobne przyczyny?');
    lines.push('2) Co mogę robić w domu przez 10 minut dziennie w najbliższym tygodniu (konkretne zabawy, bez kart pracy)?');
    lines.push('3) Czy tempo nauki jest dobre, czy coś zmienić (długość sesji, liczba nowych słów)?');
    lines.push('4) Na co uważać, żeby dziecko nie straciło motywacji?');
    lines.push('');
    lines.push('DANE Z GRY');
    lines.push('Odpowiedzi: ' + s.answers + ', poprawnych za pierwszym razem: ' + pct(s.accuracy || 0) + ', sesji: ' + s.sessions + ', dni nauki w ostatnim tygodniu: ' + s.activeDays7 + ', typowa sesja: ' + (s.medianSessionMin || '?') + ' min.');
    lines.push('Poziom ogólny (skala gry 1–5): ' + s.level + '.');
    if (st.calibration) {
      var cp = st.calibration.profile || {};
      lines.push('Test startowy: poziom ' + (cp.overall || '?') +
        (cp.weaknesses && cp.weaknesses.length ? ', słabsze: ' + cp.weaknesses.map(skillName).join(', ') : '') +
        (cp.weakContrasts && cp.weakContrasts.length ? ', trudne dźwięki: ' + cp.weakContrasts.map(function (k) { return SOUNDS[SOUND_ALIAS[k] || k] || k; }).join('; ') : '') + '.');
    }
    lines.push('Umiejętności (ostatnio / łącznie / poziom 1–5 / liczba pytań):');
    s.skills.forEach(function (k) { lines.push('- ' + k.name + ': ' + pct(k.recent) + ' / ' + pct(k.total) + ' / ' + (k.level != null ? k.level : '?') + ' / ' + k.n); });
    var words = Object.keys(st.items);
    var mastered = words.filter(function (id) { return st.items[id].box >= MASTERED_BOX; });
    var weak = words.filter(function (id) { return st.items[id].wrong >= 2 && st.items[id].box <= 1; });
    lines.push('Zapamiętane słowa (' + mastered.length + '): ' + (mastered.slice(0, 40).join(', ') || 'brak'));
    lines.push('Słowa sprawiające kłopot (' + weak.length + '): ' + (weak.slice(0, 30).map(function (id) {
      var it = st.items[id]; var c = Object.keys(it.confusions);
      return id + ' (' + it.wrong + ' błędów' + (c.length ? ', mylone z: ' + c.join('/') : '') + ')';
    }).join(', ') || 'brak'));
    if (a.problems.length) {
      lines.push('Wnioski automatycznej analizy:');
      a.problems.forEach(function (p) { lines.push('- ' + p.title + ': ' + p.evidence); });
    }
    return lines.join('\n');
  }

  var api = {
    version: VERSION,
    SKILLS: SKILLS,
    SOUNDS: SOUNDS,
    record: record,
    setLevel: setLevel,
    nextSettings: nextSettings,
    pickItems: pickItems,
    getDifficulty: getDifficulty,
    importCalibration: importCalibration,
    analyze: analyze,
    report: report,
    claudePrompt: claudePrompt,
    _normalize: normalize
  };
  root.RGAssistant = api;
  return api;
})(typeof window !== 'undefined' ? window : globalThis);

export { RGAssistant };
export default RGAssistant;
