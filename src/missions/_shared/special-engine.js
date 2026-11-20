// Misje specjalne: „Przygotuj się do kartkówki”, „Podsumowanie działów”, „Dyktando”.
// Ten sam wygląd co misje rozdziału 1 (ch1.css), bez kar i presji czasu; sprawdzian ma jedną próbę na słowo.
import { UNITS, LINES, parseCustom, loadCustom, saveCustom } from './special-data.js';
import { slug } from '../../core/say.js';

class Stop extends Error {}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => String(s || '').trim().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').toLowerCase();
const LAST_KEY = 'rg.special.lastUnit';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

function loadCss() {
  if (document.getElementById('ch1-css')) return;
  const l = document.createElement('link'); l.id = 'ch1-css'; l.rel = 'stylesheet'; l.href = new URL('./ch1.css', import.meta.url).href;
  document.head.append(l);
}

// Statystyki słów z asystenta (profile.assistant.items) albo z surowego dziennika.
export function wordStats(profile) {
  const pa = profile?.assistant || {};
  if (pa.items && typeof pa.items === 'object') return pa.items;
  const items = {};
  for (const e of pa.log || []) {
    if (!e.item) continue;
    const it = items[e.item] || (items[e.item] = { seen: 0, ok: 0, wrong: 0, box: 0 });
    it.seen++; if (e.ok) { it.ok++; it.box = Math.min(5, it.box + 1); } else { it.wrong++; it.box = 0; }
  }
  return items;
}
export function practisedUnits(profile) {
  const st = wordStats(profile);
  return UNITS.filter(u => u.words.filter(w => st[w.en]?.seen).length >= Math.ceil(u.words.length / 2));
}
export function hardestWords(profile, n = 10, units = UNITS) {
  const st = wordStats(profile);
  const seen = new Map();
  for (const u of units) for (const w of u.words) { const s = st[w.en]; if (s?.seen && !seen.has(w.en)) seen.set(w.en, { w, score: (s.wrong || 0) * 2 + (s.box <= 1 ? 2 : 0) - (s.box || 0) * 0.5 - (s.ok || 0) * 0.2 }); }
  return [...seen.values()].filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, n).map(x => x.w);
}

// ---------- powłoka ekranu misji specjalnej ----------
export function createShell(root, ctx, { id, title }) {
  loadCss();
  let alive = true, filmPending = false, curAudio = null;
  const timers = new Set(), destroyers = [];
  const settings = (() => { try { return ctx.assistant?.getDifficulty?.(ctx.profile, id) || {}; } catch (e) { return {}; } })();
  let lvl = Math.max(1, Math.min(3, Math.round(settings.level || ctx.profile?.calibration?.level || 1)));
  const slowFirst = settings.slowAudioDefault ?? lvl === 1;

  root.innerHTML = '';
  const bar = h('div', { class: 'ch1-bar-fill' }), barTxt = h('div', { class: 'ch1-bar-txt' });
  const bHear = h('button', { class: 'ch1-snd', title: 'Listen' }, '🔊'), bSlow = h('button', { class: 'ch1-snd', title: 'Slow' }, '🐢');
  const bExit = ctx.exit ? h('button', { class: 'ch1-snd', title: 'Wyjdź', onclick: () => ctx.exit() }, '✕') : null;
  const stage = h('div', { class: 'ch1-stage' });
  const subPl = h('div', { class: 'ch1-sub-pl' });
  const bubble = h('div', { class: 'ch1-bubble' }, subPl);
  const buddy = h('img', { src: new URL('./img/aegis-bust.webp', import.meta.url).href, alt: '', class: 'ch1-buddy', 'aria-hidden': 'true', onerror: e => e.target.remove() });
  root.append(h('div', { class: 'ch1' }, h('div', { class: 'ch1-top' }, h('div', { class: 'ch1-title' }, title), h('div', { class: 'ch1-bar' }, bar, barTxt), bHear, bSlow, bExit), stage, bubble, buddy));
  let replay = null;
  bHear.onclick = () => replay && replay(false).catch(() => {});
  bSlow.onclick = () => replay && replay(true).catch(() => {});
  const setReplay = fn => { replay = fn; bHear.disabled = bSlow.disabled = !fn; };
  setReplay(null);

  const check = () => { if (!alive) throw new Stop(); };
  const wait = ms => new Promise((res, rej) => { const t = setTimeout(() => { timers.delete(t); alive ? res() : rej(new Stop()); }, ms); timers.add(t); });
  const stopAudio = () => { if (curAudio) { curAudio.pause(); curAudio = null; } try { speechSynthesis.cancel(); } catch (e) {} };
  async function word(text, slow = false) { check(); stopAudio(); if (ctx.say) await ctx.say(text, { slow }); check(); }
  let lineNo = 0;
  async function aegis(line) {
    check(); stopAudio(); subPl.replaceChildren(h('div', { class: 'ch1-sub-en' }, line.en), stage.classList.contains('pl-on') ? h('div', { class: 'ch1-sub-pl2' }, line.pl) : ''); bubble.classList.add('on'); const my = ++lineNo;
    if (ctx.aegisSay) await ctx.aegisSay(line.en);
    else await new Promise(res => { const a = new Audio(`${ctx.base || ''}assets/audio/aegis/${slug(line.en)}.wav`); curAudio = a; a.onended = res; a.onpause = res; a.onerror = () => Promise.resolve(ctx.say?.(line.en)).then(res, res); a.play().catch(a.onerror); });
    check();
    const t = setTimeout(() => { timers.delete(t); if (my === lineNo) bubble.classList.remove('on'); }, 2500); timers.add(t);
  }
  let ac = null;
  function sfx(name) {
    try { if (ctx.audio?.sfx) return ctx.audio.sfx(name); } catch (e) {}
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); const f = name === 'correct' ? [660, 990] : name === 'wrong' ? [300, 220] : [440, 440];
      o.frequency.setValueAtTime(f[0], ac.currentTime); o.frequency.linearRampToValueAtTime(f[1], ac.currentTime + .15); g.gain.setValueAtTime(.12, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .25); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + .26); } catch (e) {}
  }
  function progress(frac, label) { const p = Math.round(Math.max(0, Math.min(1, frac)) * 100); bar.style.width = p + '%'; barTxt.textContent = label ?? `${p}%`; }
  function clear(...kids) { stage.innerHTML = ''; stage.classList.remove('pl-on'); setReplay(null); if (kids.length) stage.append(h('div', { class: 'ch1-q' }, ...kids)); }
  // Czeka na kliknięcie jednego z przycisków; przerywa się po wyjściu z misji.
  function clickOf(btns) {
    return new Promise((res, rej) => {
      const iv = setInterval(() => { if (!alive) { clearInterval(iv); rej(new Stop()); } }, 300);
      btns.forEach(b => b.onclick = () => { clearInterval(iv); res(b); });
    });
  }
  function rec(unit, ev) { try { ctx.record?.(Object.assign({ mission: unit ? `${id}:${unit}` : id, level: lvl }, ev)); } catch (e) { console.warn('record', e); } }

  function destroy() { if (!alive) return; alive = false; stopAudio(); timers.forEach(clearTimeout); destroyers.forEach(f => { try { f(); } catch (e) {} }); }
  // Film z rdzenia zastępuje ekran misji; po nim wracamy do tego samego ekranu.
  function film(name) {
    if (!ctx.playStory) return Promise.resolve();
    const host = root.parentNode;
    filmPending = true;
    return new Promise(res => {
      const back = () => { filmPending = false; if (host && !root.isConnected) host.replaceChildren(root); res(); };
      let r; try { r = ctx.playStory(name, back); } catch (e) { back(); return; }
      Promise.resolve(r).then(ok => { if (ok === false) back(); }, back);
    });
  }
  // Po wyjściu na inny ekran (bez filmu) sprzątamy sami.
  const watch = setInterval(() => { if (!filmPending && !root.isConnected) { clearInterval(watch); destroy(); } }, 1000);
  destroyers.push(() => clearInterval(watch));

  return {
    id, ctx, stage, bubble, h, check, wait, word, aegis, sfx, progress, clear, clickOf, setReplay, rec, film, destroy,
    get lvl() { return lvl; }, set lvl(v) { lvl = Math.max(1, Math.min(3, v)); }, slowFirst,
    get alive() { return alive; },
    cleanup: () => { if (!filmPending) { destroy(); root.innerHTML = ''; } },
    onDestroy: f => destroyers.push(f),
    error(e) { if (e instanceof Stop) return; console.error(e); stage.innerHTML = ''; stage.append(h('div', { class: 'ch1-tip on' }, 'Coś poszło nie tak. Wróć do hangaru i spróbuj jeszcze raz.')); },
  };
}

// ---------- wybór działu ----------
// opts: { allowHardest, intro }; zwraca { unitId, title, words }.
export async function chooseWords(S, { allowHardest = false, intro = 'Wybierz dział do ćwiczeń' } = {}) {
  const { h } = S;
  let last = ''; try { last = localStorage.getItem(LAST_KEY) || ''; } catch (e) {}
  S.clear(h('div', { class: 'ch1-label' }, intro), h('div', { class: 'ch1-hint' }, 'Wybiera rodzic albo dziecko razem z rodzicem.'));
  const groups = {};
  for (const u of UNITS) (groups[u.group] = groups[u.group] || []).push(u);
  const btns = [];
  const box = h('div', { class: 'sp-units' });
  if (allowHardest) {
    const hard = hardestWords(S.ctx.profile, 10);
    if (hard.length >= 3) { const b = h('button', { class: 'ch1-opt sp-unit' }, h('b', {}, '⭐ Najtrudniejsze słowa'), h('span', { class: 'ch1-pl' }, `${hard.length} słów z poprzednich gier`)); b.dataset.u = '@hard'; btns.push(b); box.append(b); }
  }
  for (const [g, list] of Object.entries(groups)) {
    box.append(h('div', { class: 'sp-group' }, g));
    for (const u of list) {
      const b = h('button', { class: 'ch1-opt sp-unit' + (u.id === last ? ' sp-last' : '') }, h('b', {}, u.title), h('span', { class: 'ch1-pl' }, u.words.slice(0, 4).map(w => w.en).join(', ') + (u.words.length > 4 ? '…' : '')));
      b.dataset.u = u.id; btns.push(b); box.append(b);
    }
  }
  const ta = h('textarea', { class: 'sp-ta', rows: 5, placeholder: 'jacket = kurtka\nscarf = szalik\nsunny = słonecznie' });
  ta.value = loadCustom();
  const useCustom = h('button', { class: 'ch1-next' }, 'Ćwicz moje słówka');
  useCustom.dataset.u = '@custom'; btns.push(useCustom);
  const err = h('div', { class: 'ch1-tip' });
  S.stage.append(box, h('details', { class: 'sp-custom' }, h('summary', {}, '✏️ Własne słówka z zeszytu (dla rodzica)'),
    h('div', { class: 'ch1-hint' }, 'Jedno słowo w linii: po angielsku, znak =, po polsku. Polskie tłumaczenie można pominąć.'), ta, h('div', { class: 'ch1-row' }, useCustom), err));
  for (;;) {
    const b = await S.clickOf(btns);
    const u = b.dataset.u;
    if (u === '@custom') {
      const words = parseCustom(ta.value);
      if (words.length < 2) { err.textContent = 'Wpisz co najmniej 2 angielskie słowa, każde w osobnej linii.'; err.classList.add('on'); continue; }
      saveCustom(ta.value);
      return { unitId: 'custom', title: 'Moje słówka', words };
    }
    if (u === '@hard') return { unitId: 'hard', title: 'Najtrudniejsze słowa', words: hardestWords(S.ctx.profile, 10) };
    try { localStorage.setItem(LAST_KEY, u); } catch (e) {}
    const unit = UNITS.find(x => x.id === u);
    return { unitId: unit.id, title: unit.title, words: unit.words.slice() };
  }
}

// ---------- mini-gry na słowach { en, pl, icon } ----------
const wv = (S, w, { en = false, pl = true, big = false } = {}) => S.h('span', { class: 'ch1-wv' + (big ? ' big' : '') },
  w.icon ? S.h('span', { class: 'ch1-ico' }, w.icon) : null, en ? S.h('span', { class: 'ch1-en' }, w.en) : null, pl && w.pl ? S.h('span', { class: 'ch1-pl' + (w.icon ? ' ch1-plh' : '') }, w.pl) : null);

export async function listenCard(S, w) {
  S.clear(S.h('div', { class: 'ch1-label' }, 'New word: listen'), S.h('div', { class: 'ch1-card' }, wv(S, w, { en: true, big: true })));
  S.setReplay(slow => S.word(w.en, slow));
  await S.word(w.en, true); await S.wait(300); await S.word(w.en, false);
  const next = S.h('button', { class: 'ch1-next' }, 'Next ›'); S.stage.append(next);
  await S.clickOf([next]);
}

// Wybór bez drugiej próby: zła odpowiedź pokazuje dobrą (zielona), gra obie, polska wskazówka, potem Next.
// Polski (etykieta, znaczenia) widać dopiero po błędzie. Zwraca true, gdy dobrze.
async function choose(S, unit, { item, skill, mode, label, labelPl, prompt = [], options, correct, play, tip, layout = '' }) {
  const { h } = S;
  S.clear(h('div', { class: 'ch1-label' }, label, labelPl ? h('span', { class: 'ch1-plh ch1-label-pl' }, labelPl) : null), ...prompt);
  const box = h('div', { class: 'ch1-opts ' + layout });
  const btns = options.map(o => { const b = h('button', { class: 'ch1-opt' }, o.el); b.dataset.k = o.key; box.append(b); return b; });
  const tipEl = h('div', { class: 'ch1-tip' });
  S.stage.append(box, tipEl);
  if (play) { S.setReplay(slow => play(slow)); await play(S.slowFirst); }
  const t0 = performance.now();
  const b = await S.clickOf(btns);
  const ok = b.dataset.k === correct;
  btns.forEach(x => x.disabled = true);
  S.rec(unit, { item, skill, mode, ok, ms: Math.round(performance.now() - t0), opts: btns.length, hint: false, chosen: ok ? null : b.dataset.k, attempts: 1 });
  if (ok) { b.classList.add('ok'); S.sfx('correct'); await S.wait(500); return true; }
  S.sfx('wrong'); b.classList.add('bad'); S.stage.classList.add('pl-on');
  btns.forEach(x => { if (x.dataset.k === correct) x.classList.add('reveal'); });
  if (tip) { tipEl.textContent = tip; tipEl.classList.add('on'); }
  await S.aegis(LINES.lookAgain);
  if (play) { await play(true); await S.wait(250); await S.word(b.dataset.k, true).catch(() => {}); }
  const next = h('button', { class: 'ch1-next' }, 'Next ›'); S.stage.append(h('div', { class: 'ch1-row' }, next)); await S.clickOf([next]);
  return false;
}
const others = (w, pool, n) => shuffle(pool.filter(x => norm(x.en) !== norm(w.en) && (!x.pl || x.pl !== w.pl))).slice(0, n);
const nOpts = S => Math.min(4, S.lvl + 1);

export function earGame(S, unit, w, pool) { // słyszysz → znaczenie
  const opts = shuffle([w, ...others(w, pool.filter(x => x.pl), nOpts(S) - 1)]);
  return choose(S, unit, { item: w.en, skill: 'listening', mode: 'listen', label: 'What do you hear?', labelPl: 'Co słyszysz?', layout: opts.length === 2 ? 'two' : '',
    options: opts.map(x => ({ key: x.en, el: x.icon ? wv(S, x) : S.h('span', { class: 'ch1-en sp-word' }, x.en) })), correct: w.en, play: slow => S.word(w.en, slow), tip: `Słychać było ${w.en} = ${w.pl || w.en}.` });
}
export function readGame(S, unit, w, pool) { // napis → znaczenie
  const opts = shuffle([w, ...others(w, pool.filter(x => x.pl), nOpts(S) - 1)]);
  return choose(S, unit, { item: w.en, skill: 'reading', mode: 'read', label: 'Read. What does it mean?', labelPl: 'Przeczytaj i wybierz, co to znaczy', prompt: [S.h('div', { class: 'ch1-read' }, w.en)],
    options: opts.map(x => ({ key: x.en, el: wv(S, x) })), correct: w.en, tip: `${w.en} = ${w.pl}` }).then(async ok => { await S.word(w.en).catch(() => {}); return ok; });
}
export function plGame(S, unit, w, pool) { // polskie → angielskie
  const opts = shuffle([w, ...others(w, pool, nOpts(S) - 1)]);
  return choose(S, unit, { item: w.en, skill: 'vocab', mode: 'choose', label: 'How do you say it in English?', labelPl: 'Jak to jest po angielsku?', prompt: [S.h('span', { class: 'ch1-wv big' }, w.icon ? S.h('span', { class: 'ch1-ico' }, w.icon) : null, S.h('span', { class: 'ch1-pl' }, w.pl || ''))], layout: 'letters',
    options: opts.map(x => ({ key: x.en, el: S.h('span', { class: 'ch1-en sp-word' }, x.en) })), correct: w.en, tip: 'Posłuchaj, jak brzmi dobre słowo.',
    play: null }).then(async ok => { await S.word(w.en).catch(() => {}); return ok; });
}

// Składanie słowa z liter (znaki inne niż litery są już wpisane).
export async function buildGame(S, unit, w) {
  const { h } = S;
  S.clear(h('div', { class: 'ch1-label' }, 'Build the word'), wv(S, w));
  const chars = [...w.en];
  const slotsEl = h('div', { class: 'ch1-slots' }), tilesEl = h('div', { class: 'ch1-tiles' }), tipEl = h('div', { class: 'ch1-tip' });
  S.stage.append(slotsEl, tilesEl, tipEl);
  const slots = chars.map(c => { const s = h('div', { class: 'ch1-slot' + (/[a-z]/i.test(c) ? '' : ' fixed') }, /[a-z]/i.test(c) ? '' : c); slotsEl.append(s); return s; });
  const extra = S.lvl >= 2 ? shuffle('aeioutdy'.split('').filter(c => !w.en.toLowerCase().includes(c))).slice(0, S.lvl === 2 ? 2 : 3) : [];
  const tiles = shuffle([...chars.filter(c => /[a-z]/i.test(c)), ...extra]).map(c => { const b = h('button', { class: 'ch1-tile' }, c); b.dataset.t = c; tilesEl.append(b); return b; });
  S.setReplay(slow => S.word(w.en, slow));
  await S.word(w.en, S.slowFirst);
  let pos = 0, errors = 0; const wrong = []; const t0 = performance.now();
  const skip = () => { while (pos < chars.length && !/[a-z]/i.test(chars[pos])) pos++; };
  skip();
  while (pos < chars.length) {
    const b = await S.clickOf(tiles.filter(x => !x.disabled));
    if (b.dataset.t.toLowerCase() === chars[pos].toLowerCase()) {
      slots[pos].textContent = chars[pos]; slots[pos].classList.add('filled'); b.disabled = true; tiles.forEach(x => x.classList.remove('glow')); pos++; skip();
    } else {
      errors++; wrong.push(b.dataset.t); S.sfx('wrong'); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400);
      tipEl.textContent = 'Posłuchaj jeszcze raz, powoli, dźwięk po dźwięku.'; tipEl.classList.add('on');
      if (errors >= 2) tiles.find(x => !x.disabled && x.dataset.t.toLowerCase() === chars[pos].toLowerCase())?.classList.add('glow');
      S.word(w.en, true).catch(() => {});
    }
  }
  slotsEl.classList.add('ok'); S.sfx('correct');
  S.rec(unit, { item: w.en, skill: 'spelling', mode: 'drag', ok: errors === 0, ms: Math.round(performance.now() - t0), opts: tiles.length, hint: errors > 0, chosen: wrong[0] || null, errors });
  await S.word(w.en).catch(() => {}); await S.wait(300);
  return errors === 0;
}

// Porównanie wpisu z wzorem: lista znaków { c, k } gdzie k = ok | bad (zła litera) | miss (brak) | extra (zbędna).
export function diffWord(typed, target) {
  const a = [...typed], b = [...target], A = a.map(c => c.toLowerCase()), B = b.map(c => c.toLowerCase());
  const n = a.length, m = b.length, d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
  const out = []; let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1)) { out.push({ c: A[i - 1] === B[j - 1] ? b[j - 1] : a[i - 1], k: A[i - 1] === B[j - 1] ? 'ok' : 'bad', want: b[j - 1] }); i--; j--; }
    else if (j > 0 && d[i][j] === d[i][j - 1] + 1) { out.push({ c: '_', k: 'miss', want: b[j - 1] }); j--; }
    else { out.push({ c: a[i - 1], k: 'extra' }); i--; }
  }
  return out.reverse();
}
function diffView(h, typed, target) {
  return h('div', { class: 'sp-diff' }, diffWord(typed, target).map(x => h('span', { class: 'sp-d ' + x.k, title: x.want ? `powinno być: ${x.want}` : 'ta litera jest zbędna' }, x.c === ' ' ? ' ' : x.c)));
}
function polishTip(typed, target) {
  const t = norm(typed), w = norm(target);
  if (w.includes('i') && t.includes('y') && !w.includes('y')) return 'Krótkie „i” piszemy literą i, nie y.';
  if (/sz/.test(t) && /sh/.test(w)) return 'Polskie „sz” po angielsku to sh.';
  if (/cz/.test(t) && /ch/.test(w)) return 'Polskie „cz” po angielsku to ch.';
  if (/w/.test(t) && /v/.test(w) && !/w/.test(w)) return 'Tu jest litera v (jak polskie „w”).';
  if (w.endsWith('t') && t.endsWith('d')) return 'Na końcu jest t, nie d.';
  if (w.endsWith('d') && t.endsWith('t')) return 'Na końcu jest d, nie t.';
  if (/[aeiou]{2}/.test(w) && !/[aeiou]{2}/.test(t)) return 'W tym słowie są dwie samogłoski obok siebie. Popatrz na czerwone miejsca.';
  return null;
}

// Wpisywanie z klawiatury. mode: 'dict' (słyszysz), 'pl' (widzisz polskie). test=true: jedna próba, bez podpowiedzi.
export async function typeGame(S, unit, w, { mode = 'dict', test = false, label } = {}) {
  const { h } = S;
  const prompt = mode === 'dict' ? [S.h('div', { class: 'ch1-hint' }, S.lvl === 1 && w.pl ? `(${w.pl})` : '')] : [wv(S, w, { big: true })];
  S.clear(h('div', { class: 'ch1-label' }, label || (mode === 'dict' ? 'Write the word you hear' : 'Write it in English')), ...prompt);
  const input = h('input', { class: 'sp-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Wpisz słowo' });
  const ok = h('button', { class: 'ch1-next' }, 'Check ✓');
  const res = h('div', { class: 'sp-res' }), tipEl = h('div', { class: 'ch1-tip' });
  S.stage.append(h('div', { class: 'ch1-row' }, input, ok), res, tipEl);
  const play = slow => S.word(w.en, slow);
  if (mode === 'dict' || !test) S.setReplay(play);
  setTimeout(() => input.focus(), 50);
  if (mode === 'dict') await play(S.slowFirst);
  const t0 = performance.now(); let tries = 0, first = null, ms = 0, copy = false;
  for (;;) {
    const typed = await new Promise((resolve, reject) => {
      const iv = setInterval(() => { if (!S.alive) { clearInterval(iv); reject(new Stop()); } }, 300);
      const go = () => { if (!input.value.trim()) { input.focus(); return; } clearInterval(iv); resolve(input.value); };
      ok.onclick = go; input.onkeydown = e => { if (e.key === 'Enter') go(); };
    });
    const good = norm(typed) === norm(w.en);
    if (!copy) tries++;
    if (tries === 1 && !copy) { first = good ? null : typed.trim(); ms = Math.round(performance.now() - t0); }
    res.innerHTML = ''; res.append(diffView(h, typed.trim(), w.en));
    if (good) {
      res.classList.add('ok'); S.sfx('correct'); input.disabled = ok.disabled = true;
      if (!copy) S.rec(unit, { item: w.en, skill: 'spelling', mode: 'type', ok: tries === 1, ms, opts: 0, hint: tries > 1, chosen: first, attempts: tries, test });
      await S.word(w.en).catch(() => {}); await S.wait(400);
      return tries === 1 && !copy;
    }
    S.sfx('wrong');
    if (test) {
      S.rec(unit, { item: w.en, skill: 'spelling', mode: 'type', ok: false, ms, opts: 0, hint: false, chosen: first, attempts: 1, test });
      res.append(h('div', { class: 'sp-correct' }, 'Poprawnie: ', h('b', {}, w.en), w.pl ? ` (${w.pl})` : ''));
      input.disabled = true; ok.textContent = 'Next ›'; ok.onclick = null;
      S.word(w.en).catch(() => {});
      await S.clickOf([ok]); return false;
    }
    if (tries === 1) {
      S.stage.classList.add('pl-on'); tipEl.textContent = polishTip(typed, w.en) || 'Czerwone litery są złe, „_” to brakująca litera. Popraw i sprawdź jeszcze raz.'; tipEl.classList.add('on');
      await S.aegis(LINES.dictFix); await play(true);
    } else if (!copy) {
      copy = true;
      S.rec(unit, { item: w.en, skill: 'spelling', mode: 'type', ok: false, ms, opts: 0, hint: true, chosen: first, attempts: tries, test });
      res.append(h('div', { class: 'sp-correct' }, 'This is how you write it: ', h('b', {}, w.en)));
      await S.aegis(LINES.dictCopy); await play(true);
    }
    input.select();
  }
}

export function starsFor(ok, total) { const r = total ? ok / total : 1; return r >= 0.9 ? 3 : r >= 0.7 ? 2 : 1; }

// Trening słów: każde słowo przechodzi etapy 0 posłuchaj → 1 słyszę → 2 czytam / polski→angielski → 3 układam → 4 piszę.
// Naraz w grze najwyżej 6 słów; koniec po `minutes` minutach albo gdy wszystkie słowa przejdą etap 4.
export async function practice(S, unit, words, { minutes = 10, startStage = 0, label = 'Trening' } = {}) {
  const stage = new Map(words.map(w => [w.en, startStage]));
  const firstOk = new Map(); const hard = new Set();
  const t0 = Date.now(); let last = null, turns = 0;
  const pool = words;
  const active = () => words.filter(w => stage.get(w.en) < 5).slice(0, 6);
  const total = words.length * (5 - startStage);
  for (;;) {
    S.check();
    const act = active();
    if (!act.length || (Date.now() - t0 > minutes * 60000 && turns >= words.length)) break;
    const minSt = Math.min(...act.map(w => stage.get(w.en)));
    let cand = act.filter(w => stage.get(w.en) <= minSt + 1 && w !== last);
    if (!cand.length) cand = act.filter(w => w !== last);
    if (!cand.length) cand = act;
    const w = cand[Math.floor(Math.random() * cand.length)];
    last = w; turns++;
    const st = stage.get(w.en);
    let ok = true;
    if (st === 0) await listenCard(S, w);
    else if (st === 1) ok = await earGame(S, unit, w, pool);
    else if (st === 2) ok = await (turns % 2 ? readGame(S, unit, w, pool) : plGame(S, unit, w, pool));
    else if (st === 3) ok = /^[A-Za-z' -]{1,14}$/.test(w.en) && w.en.length <= 12 ? await buildGame(S, unit, w) : await plGame(S, unit, w, pool);
    else ok = await typeGame(S, unit, w, { mode: turns % 2 ? 'dict' : 'pl' });
    if (st > 0 && !firstOk.has(w.en)) firstOk.set(w.en, ok);
    if (!ok) hard.add(w.en);
    stage.set(w.en, ok ? st + 1 : Math.max(1, st - 1));
    const doneSteps = words.reduce((s, x) => s + stage.get(x.en) - startStage, 0);
    const timeFrac = (Date.now() - t0) / (minutes * 60000);
    S.progress(Math.max(doneSteps / total, Math.min(timeFrac, 0.95)), `${label}: ${Math.round(Math.max(doneSteps / total, Math.min(timeFrac, .95)) * 100)}%`);
  }
  return { hard: [...hard], mastered: words.filter(w => stage.get(w.en) >= 5).map(w => w.en) };
}
