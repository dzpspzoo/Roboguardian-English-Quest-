// Silnik misji rozdziału 1. Jedna funkcja: runMission(root, ctx, M) -> sprzątanie.
// Zasady: bez kar i presji czasu, angielski głos + polski napis, gra sama ocenia.
// Zła odpowiedź kończy próbę: gra pokazuje dobrą odpowiedź, gra obie wersje, tłumaczy po polsku,
// a słowo wraca raz później w tej samej minigrze (bez zgadywania drugi raz).
// Mowa oceniana tylko lokalnie przez window.RGSpeech (głos dziecka nie wychodzi z urządzenia).
import { WORDS, SOUNDS, SPELL_TIPS, AEGIS_LINES, MISSIONS, PARTS, PARTS_EN } from './ch1-data.js';
import { slug } from '../../core/say.js';

const CSS_ID = 'ch1-css';
class Stop extends Error {}

// Poziomy trudności (1 łatwy, 2 średni, 3 trudny). Asystent AI może nadpisać każdą wartość.
export const LEVELS = {
  1: { opts: 2, fallSec: 11, plHint: true, slowFirst: true, distractors: 0, prefill: 1, n: { ear: 6, letter: 3, catch: 5, build: 3, read: 4, phrase: 2, command: 5, talk: 3, listen: 6, say: 3, memory: 3, sort: 6, translate: 4, teach: 2 } },
  2: { opts: 3, fallSec: 8.5, plHint: true, slowFirst: false, distractors: 2, prefill: 0, n: { ear: 7, letter: 4, catch: 6, build: 4, read: 5, phrase: 3, command: 6, talk: 3, listen: 6, say: 3, memory: 4, sort: 8, translate: 5, teach: 3 } },
  3: { opts: 4, fallSec: 6.5, plHint: false, slowFirst: false, distractors: 4, prefill: 0, n: { ear: 8, letter: 5, catch: 7, build: 5, read: 6, phrase: 3, command: 6, talk: 3, listen: 4, say: 4, memory: 5, sort: 10, translate: 6, teach: 3 } },
};

const SKILL = {
  listen: s => `phoneme.${s}`, ear: s => `phoneme.${s}`, letter: () => 'phonics', catch: () => 'vocab',
  build: () => 'spelling', read: () => 'reading', phrase: () => 'listening', command: () => 'listening', talk: () => 'dialog', echo: () => 'speaking',
  say: () => 'speaking', memory: () => 'vocab', sort: s => `phoneme.${s}`, translate: () => 'vocab', teach: () => 'phrases',
};
const MODE = { ear: 'listen', letter: 'choose', catch: 'choose', build: 'drag', read: 'read', phrase: 'listen', command: 'listen', talk: 'choose', echo: 'speak',
  say: 'speak', memory: 'match', sort: 'listen', translate: 'type', teach: 'choose' };

// ---------- porównywanie odpowiedzi (mowa i pisanie) ----------
const NUM = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' };
const PLNUM = { 6: 'szesc', 10: 'dziesiec' };
const fold = s => String(s).toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const normEn = s => fold(s).replace(/\bi'm\b/g, 'i am').replace(/\bit's\b/g, 'it is').replace(/\blet's\b/g, 'let us').replace(/\bcan't\b/g, 'can not').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).map(t => NUM[t] || t);
export const normPl = s => fold(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).map(t => PLNUM[t] || t).join(' ');
export function matchEn(target, alts) {
  const want = normEn(target);
  let best = -1, heard = alts[0] || '';
  for (const a of alts) { const got = normEn(a); const sc = want.filter(w => got.includes(w)).length / want.length; if (sc > best) { best = sc; heard = a; } }
  return { ok: want.length === 1 ? best === 1 : best >= 0.75, heard: String(heard).trim() };
}
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// Polskie znaczenia słowa: główne (bez nawiasów, rozdzielone / lub ,) + alt.
export function plAnswers(w) {
  const d = WORDS[w] || {};
  return [...String(d.pl || '').replace(/\(.*?\)/g, '').split(/[\/,]/), ...(d.alt || [])].map(x => normPl(x)).filter(Boolean);
}
export function matchPl(accepted, text, rivals = []) {
  const got = ' ' + normPl(text) + ' ';
  if (accepted.some(a => got.includes(' ' + a + ' '))) return true;
  const g = got.trim();
  if (g.length >= 5 && !rivals.some(a => lev(a, g) <= 1)) return accepted.some(a => a.length >= 5 && lev(a, g) <= 1); // literówka
  return false;
}
const speech = () => (typeof window !== 'undefined' && window.RGSpeech) || null;

const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const md = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

function wordView(w, { showEn = false, big = false } = {}) {
  const d = WORDS[w] || {};
  return h('span', { class: 'ch1-wv' + (big ? ' big' : '') },
    d.icon ? h('span', { class: 'ch1-ico' }, d.icon) : null,
    showEn ? h('span', { class: 'ch1-en' }, w) : null,
    h('span', { class: 'ch1-pl ch1-plh' }, d.pl || ''));
}
// Etykieta zadania: po angielsku; polskie tłumaczenie (ch1-plh) widać dopiero po błędzie (klasa pl-on na scenie).
function lab(en, pl) { return h('div', { class: 'ch1-label' }, en, pl ? h('span', { class: 'ch1-plh ch1-label-pl' }, pl) : null); }

function loadCss(base) {
  if (document.getElementById(CSS_ID)) return;
  const l = document.createElement('link');
  l.id = CSS_ID; l.rel = 'stylesheet';
  l.href = new URL('./ch1.css', import.meta.url).href;
  document.head.append(l);
}

// ---------- ustawienia trudności ----------
function initialSettings(ctx, M) {
  let s = {};
  try {
    const A = ctx.assistant;
    if (A?.getDifficulty) {
      const d = A.getDifficulty(ctx.profile, M.id) || {};
      s = { level: d.level, opts: d.maxChoices, slow: d.slowAudioDefault, speed: d.speed, suggestBreak: d.suggestBreak,
        plHint: d.polishHint == null ? undefined : d.polishHint !== 'never' };
    } else if (A?.nextSettings) s = A.nextSettings(ctx.profile, M.id) || {};
  } catch (e) { console.warn('ustawienia asystenta', e); }
  let level = s.level;
  if (!level) { // bez asystenta: poziom z poprzedniej gry w tę misję lub z kalibracji
    const prev = ctx.profile?.progress?.missions?.[M.id]?.last;
    level = prev?.level || ctx.profile?.calibration?.level || 1;
  }
  level = Math.max(1, Math.min(3, Math.round(level)));
  return { level, override: s };
}

export function runMission(root, ctx, M) {
  loadCss(ctx.base);
  const base = ctx.base || '';
  let alive = true;
  let curAudio = null;
  const timers = new Set();
  const st = initialSettings(ctx, M);
  let lvl = st.level;
  const startLevel = lvl;
  const stats = { items: 0, firstTry: 0, perSkill: {}, hard: new Set(), good: new Set(), streakOk: 0, streakBad: 0, praise: 0 };
  const L = () => Object.assign({}, LEVELS[lvl], filterOverride(st.override));
  function filterOverride(o) {
    const r = {};
    if (o.opts) r.opts = Math.max(2, Math.min(4, o.opts));
    if (typeof o.plHint === 'boolean') r.plHint = o.plHint;
    if (typeof o.slow === 'boolean') r.slowFirst = o.slow;
    if (o.speed) r.fallSec = LEVELS[lvl].fallSec / o.speed;
    return r;
  }
  const check = () => { if (!alive) throw new Stop(); };
  const wait = ms => new Promise((res, rej) => { const t = setTimeout(() => { timers.delete(t); alive ? res() : rej(new Stop()); }, ms); timers.add(t); });

  // ---------- szkielet ekranu ----------
  root.innerHTML = '';
  const bar = h('div', { class: 'ch1-bar-fill' });
  const barTxt = h('div', { class: 'ch1-bar-txt' });
  const bHear = h('button', { class: 'ch1-snd', title: 'Listen' }, '🔊');
  const bSlow = h('button', { class: 'ch1-snd', title: 'Slow' }, '🐢');
  const stage = h('div', { class: 'ch1-stage' });
  const subPl = h('div', { class: 'ch1-sub-pl' });
  const bubble = h('div', { class: 'ch1-bubble' }, subPl);
  const buddy = h('img', { src: new URL('./img/aegis-bust.webp', import.meta.url).href, alt: '', class: 'ch1-buddy', 'aria-hidden': 'true', onerror: e => e.target.remove() });
  const wrap = h('div', { class: 'ch1' },
    h('div', { class: 'ch1-top' },
      h('div', { class: 'ch1-title' }, `Mission ${M.nr}: ${M.titleEn || M.title}`),
      h('div', { class: 'ch1-bar' }, bar, barTxt),
      bHear, bSlow),
    stage, bubble, buddy);
  root.append(wrap);
  let replay = null; // aktualne nagranie pod przyciskami 🔊 / 🐢
  bHear.onclick = () => replay && replay(false);
  bSlow.onclick = () => replay && replay(true);
  const setReplay = fn => { replay = fn; bHear.disabled = bSlow.disabled = !fn; };
  setReplay(null);

  function progress(frac) {
    const p = Math.round(Math.max(0, Math.min(1, frac)) * 100);
    bar.style.width = p + '%';
    barTxt.textContent = M.parts.length ? `Repair: ${p}%` : `Start-up: ${p}%`;
  }

  // ---------- dźwięk ----------
  function stopAudio() { if (curAudio) { curAudio.pause(); curAudio = null; } try { speechSynthesis.cancel(); } catch (e) {} }
  async function word(text, slow = false) {
    check(); stopAudio();
    if (ctx.say) await ctx.say(text, { slow, base });
    check();
  }
  let lineNo = 0;
  // Kwestia AEGIS-7: nagranie robota assets/audio/aegis/<slug>.wav, w razie braku czysty głos.
  async function aegis(line, { sub = true } = {}) {
    check(); stopAudio();
    if (sub) { subPl.replaceChildren(h('div', { class: 'ch1-sub-en' }, line.en), stage.classList.contains('pl-on') ? h('div', { class: 'ch1-sub-pl2' }, line.pl) : ''); bubble.classList.add('on'); }
    const myLine = ++lineNo;
    // Kolejno: nagranie robota (.wav), nagranie ElevenLabs (words/en). Bez nagrania: tylko napis (bez syntezatora).
    const srcs = [`${base}assets/audio/aegis/${slug(line.en)}.wav`, `${base}assets/audio/words/en/${slug(line.en)}.mp3`];
    const vol = ctx.profile?.settings?.voiceVol;
    let played = false;
    for (const src of srcs) {
      if (played || !alive) break;
      const a = new Audio(src); curAudio = a;
      if (typeof vol === 'number') a.volume = vol;
      played = await new Promise(res => {
        a.onended = () => res(true); a.onpause = () => res(true); a.onerror = () => res(false);
        a.play().catch(err => res(err?.name === 'NotAllowedError'));
      });
    }
    if (!played) await new Promise(r => setTimeout(r, 900 + 45 * line.pl.length));
    check();
    const t = setTimeout(() => { timers.delete(t); if (myLine === lineNo) bubble.classList.remove('on'); }, 2500); timers.add(t);
  }
  function sfx(id) {
    try {
      const A = ctx.audio;
      if (A?.sfx) return A.sfx(id);
      if (A?.playSfx) return A.playSfx(id);
    } catch (e) {}
    beep(id);
  }
  let ac = null;
  function beep(id) { // zapas, gdy moduł muzyki jeszcze nie istnieje
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      const f = { correct: [660, 990], wrong: [300, 220], part_attach: [200, 400], click: [500, 500] }[id] || [440, 440];
      o.frequency.setValueAtTime(f[0], ac.currentTime); o.frequency.linearRampToValueAtTime(f[1], ac.currentTime + 0.15);
      g.gain.setValueAtTime(0.12, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
      o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.26);
    } catch (e) {}
  }
  try { ctx.audio?.music?.('mission_calm'); } catch (e) {}

  // ---------- zapis odpowiedzi i adaptacja ----------
  function rec(game, ev) {
    try {
      ctx.record?.(Object.assign({ mission: M.id, skill: SKILL[game](M.sound), mode: MODE[game], level: lvl, game, sound: M.sound }, ev));
    } catch (e) { console.warn('record', e); }
  }
  async function itemDone(game, item, firstTry) {
    stats.items++;
    const sk = SKILL[game](M.sound);
    const ps = stats.perSkill[sk] = stats.perSkill[sk] || { ok: 0, total: 0 };
    ps.total++;
    if (firstTry) { stats.firstTry++; ps.ok++; stats.good.add(item); stats.streakOk++; stats.streakBad = 0; }
    else { stats.hard.add(item); stats.streakBad++; stats.streakOk = 0; }
    if (stats.streakBad >= 2 && lvl > 1) { lvl--; stats.streakBad = 0; await aegis(AEGIS_LINES.slowDown); }
    else if (stats.streakOk >= 5 && lvl < 3) { lvl++; stats.streakOk = 0; }
    if (firstTry && ++stats.praise % 3 === 0) await aegis(nextLine('great'));
  }

  // ---------- wspólne: pytanie z wyborem ----------
  // options: [{ key, el }]; correct: key; play: (slow) => Promise; tip: tekst PL do wyjaśnienia;
  // contrast(chosenKey): odtwarza złą odpowiedź (żeby było słychać różnicę).
  async function choice({ game, item, options, correct, play, tip, layout = '', contrast = null, explain = null }) {
    check();
    const box = h('div', { class: 'ch1-opts ' + layout });
    const btns = options.map(o => { const b = h('button', { class: 'ch1-opt' }, o.el); b.dataset.key = o.key; box.append(b); return b; });
    stage.append(box);
    const tipEl = h('div', { class: 'ch1-tip' }); stage.append(tipEl);
    setReplay(play ? (slow => play(slow).catch(() => {})) : null);
    const nOpts = btns.length;
    const t0 = performance.now();
    if (play) await play(L().slowFirst);
    check();
    const key = await new Promise((res, rej) => {
      const iv = setInterval(() => { if (!alive) { clearInterval(iv); rej(new Stop()); } }, 300);
      btns.forEach(b => { b.onclick = () => { clearInterval(iv); res(b.dataset.key); }; });
    });
    const ms = Math.round(performance.now() - t0);
    const ok = key === String(correct);
    const b = btns.find(x => x.dataset.key === key);
    btns.forEach(x => x.disabled = true);
    rec(game, { item, ok, ms, opts: nOpts, hint: false, chosen: ok ? null : key, attempts: 1 });
    if (ok) {
      b.classList.add('ok'); sfx('correct');
      await wait(450);
      box.remove(); tipEl.remove();
      await itemDone(game, item, true);
      return true;
    }
    // Zła odpowiedź: pokaż dobrą, zagraj obie, wyjaśnij. Bez drugiej próby.
    sfx('wrong'); b.classList.add('bad'); plOn();
    const good = btns.find(x => x.dataset.key === String(correct)); good && good.classList.add('reveal');
    const why = explain ? explain(key) : null;
    tipEl.innerHTML = md(why || tip || 'Popatrz na dobrą odpowiedź i posłuchaj.'); tipEl.classList.add('on');
    await aegis(nextLine('oops'));
    if (play) { await play(true); if (contrast) { await wait(300); await contrast(key); await wait(300); await play(false); } }
    await nextButton();
    box.remove(); tipEl.remove();
    await itemDone(game, item, false);
    return false;
  }
  async function nextButton(label = 'Next ›') {
    const nb = h('button', { class: 'ch1-next' }, label);
    const row = h('div', { class: 'ch1-row' }, nb); stage.append(row);
    await new Promise((res, rej) => { const iv = setInterval(() => { if (!alive) { clearInterval(iv); rej(new Stop()); } }, 300); nb.onclick = () => { clearInterval(iv); res(); }; });
    row.remove();
  }
  // Losowanie kwestii bez powtórek, dopóki pula się nie wyczerpie.
  const used = {};
  function nextLine(pool) {
    const all = AEGIS_LINES[pool]; if (!Array.isArray(all)) return all;
    used[pool] = used[pool] || [];
    let left = all.filter(x => !used[pool].includes(x)); if (!left.length) { used[pool] = []; left = all; }
    const l = pick(left); used[pool].push(l); return l;
  }
  const meaning = w => `**${w}** = ${WORDS[w]?.pl || '?'} ${WORDS[w]?.icon || ''}`;
  const pairExplain = correct => chosen => `Słychać było ${meaning(correct)}. Ty wybrałeś ${meaning(chosen)}. Posłuchaj różnicy: najpierw ${correct}, potem ${chosen}. ${SOUNDS[M.sound].tipPl}`;

  const plOn = () => stage.classList.add('pl-on'); // polski dopiero po błędzie
  function header(...kids) { stage.innerHTML = ''; stage.classList.remove('pl-on'); const el = h('div', { class: 'ch1-q' }, ...kids); stage.append(el); return el; }

  // Kolejka z jednym powtórzeniem: element źle rozwiązany wraca raz na koniec.
  async function queue(items, fn) {
    const q = items.map(x => ({ x, again: false }));
    let done = 0;
    while (q.length) {
      const it = q.shift();
      const ok = await fn(it.x, done);
      if (!ok && !it.again) q.push({ x: it.x, again: true });
      done++;
    }
  }

  // Pule z poprzednich misji (powtórki rozłożone w czasie).
  function earlierPairs() {
    return MISSIONS.filter(m => m.nr < M.nr).flatMap(m => m.pairs || []);
  }
  function pickItems(pool, n, keyOf) {
    try {
      const A = ctx.assistant;
      if (A?.pickItems) { const r = A.pickItems(ctx.profile, pool.map(keyOf), n, M.id); if (Array.isArray(r) && r.length) {
        const out = r.map(k => pool.find(p => keyOf(p) === (typeof k === 'object' && k ? keyOf(k) : k))).filter(Boolean).slice(0, n);
        for (const p of shuffle(pool)) { if (out.length >= n) break; if (!out.includes(p)) out.push(p); }
        if (out.length) return out;
      } }
    } catch (e) { console.warn('pickItems', e); }
    const out = shuffle(pool); while (out.length < n && pool.length) out.push(...shuffle(pool)); return out.slice(0, n);
  }

  // ---------- mini-gry ----------
  const GAMES = {};

  // 1. Osłuchanie: obrazek + polskie znaczenie, słowo wolno i normalnie. Bez zapisu i bez oceny.
  GAMES.listen = async () => {
    const tip = SOUNDS[M.sound];
    header(lab('Listen', 'Posłuchaj'), h('div', { class: 'ch1-soundtip ch1-plh', html: md(tip.tipPl) }));
    const words = M.words.slice(0, L().n.listen);
    for (const w of words) {
      check();
      const card = h('div', { class: 'ch1-card' }, wordView(w, { big: true, showEn: true }));
      stage.querySelector('.ch1-card')?.remove();
      stage.append(card);
      setReplay(slow => word(w, slow));
      await word(w, true); await wait(350); await word(w, false); await wait(600);
    }
    const next = h('button', { class: 'ch1-next' }, 'Next ›');
    stage.append(next);
    await new Promise(res => next.onclick = res);
  };

  // 2. Rozróżnianie par: słychać jedno słowo, wybierasz obrazek/znaczenie.
  GAMES.ear = async () => {
    const pool = M.pairs.map(p => ({ p, review: false }));
    if (M.nr > 1 && !M.review) shuffle(earlierPairs()).slice(0, 2).forEach(p => pool.push({ p, review: true }));
    if (M.review) earlierPairs().forEach(p => pool.push({ p, review: true }));
    const items = pickItems(pool, L().n.ear, x => x.p.join('/')).map(x => { const t = pick(x.p); return { pair: x.p, target: t }; });
    await queue(items, async it => {
      header(lab('Which word do you hear?', 'Które słowo słyszysz?'));
      const opts = shuffle(it.pair).map(w => ({ key: w, el: wordView(w, { showEn: lvl >= 3 }) }));
      return choice({ game: 'ear', item: it.target, options: opts, correct: it.target, layout: 'two',
        play: slow => word(it.target, slow), tip: SOUNDS[M.sound].tipPl, contrast: k => word(k, true), explain: pairExplain(it.target) });
    });
  };

  // 3. Dźwięk i litera: słowo z luką, wybierasz brakującą literę.
  GAMES.letter = async () => {
    const slots = pickItems(M.letterSlots || [], L().n.letter, s => s.w + '#' + s.gap);
    await queue(slots, async s => {
      const letters = s.w.split('');
      const shown = letters.map((c, i) => i === s.gap ? '_' : c).join(' ');
      header(lab('Which letter is missing?', 'Jakiej litery brakuje?'), wordView(s.w), h('div', { class: 'ch1-gapword' }, shown));
      const correct = letters[s.gap];
      let opts = s.opts.slice();
      if (L().opts === 2) opts = [correct, opts.find(o => o !== correct)];
      const tip = tipFor(correct, opts.find(o => o !== correct)) || SOUNDS[M.sound].tipPl;
      return choice({ game: 'letter', item: s.w, options: shuffle(opts).map(o => ({ key: o, el: h('span', { class: 'ch1-letter' }, o) })), correct,
        play: slow => word(s.w, slow), layout: 'letters',
        explain: k => `Brakowało litery **${correct}**: ${s.w}. ${tipFor(correct, k) || tip}` });
    });
  };

  // 4. Łapanie części: spadają części z napisami, łapiesz tę, którą słyszysz.
  GAMES.catch = async () => {
    const targets = pickItems(M.words, L().n.catch, w => w);
    await queue(targets, async target => {
      header(lab('Catch the word you hear', 'Złap część z usłyszanym słowem'));
      const others = shuffle(M.words.filter(w => w !== target && w.toLowerCase() !== target.toLowerCase()));
      const labels = shuffle([target, ...others.slice(0, L().opts - 1)]);
      return catchRound(target, labels);
    });
  };

  async function catchRound(target, labels) {
    const cv = h('canvas', { class: 'ch1-cv' });
    const tipEl = h('div', { class: 'ch1-tip' });
    stage.append(cv, tipEl);
    const g = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;
    const resize = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    const showIcon = lvl <= 2;
    const items = labels.map((w, i) => ({ w, x: 0, y: 0, gone: false, bad: false, glow: false, i }));
    const place = () => items.forEach((it, i) => { it.x = W * (i + 1) / (items.length + 1); it.y = 36 - i * 40 - Math.random() * 20; });
    place();
    let clawX = W / 2, targetX = null;
    const keys = {};
    const kd = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { keys[e.key] = true; e.preventDefault(); } };
    const ku = e => { keys[e.key] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    window.addEventListener('resize', resize);
    const play = slow => word(target, slow);
    setReplay(slow => play(slow).catch(() => {}));
    let attempts = 0, resolveCatch = null, busy = false, hint = false, firstChosen = null, firstMs = 0;
    const t0 = performance.now();
    const BW = 120, BH = 58;
    cv.onpointerdown = e => {
      const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
      const hit = items.find(it => !it.gone && Math.abs(x - it.x) < BW / 2 && Math.abs(y - it.y) < BH / 2 + 6);
      if (hit) caught(hit); else targetX = x;
    };
    function caught(it) { if (busy || it.gone) return; resolveCatch && resolveCatch(it); }
    let last = performance.now(), raf = 0, paused = true;
    const loop = now => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const speed = H / L().fallSec;
      if (keys.ArrowLeft) clawX -= 520 * dt;
      if (keys.ArrowRight) clawX += 520 * dt;
      if (targetX != null) { const d = targetX - clawX; clawX += Math.sign(d) * Math.min(Math.abs(d), 640 * dt); if (Math.abs(d) < 2) targetX = null; }
      clawX = Math.max(60, Math.min(W - 60, clawX));
      const clawY = H - 46;
      if (!paused) for (const it of items) {
        if (it.gone) continue;
        it.y += speed * (it.glow ? 0.5 : 1) * dt;
        if (it.y + BH / 2 >= clawY - 6 && it.y < clawY + 10 && Math.abs(it.x - clawX) < 70) caught(it);
      }
      if (!paused && items.every(it => it.gone || it.y > H + 40)) { place(); items.forEach(it => { if (it.bad) it.gone = true; }); play(false).catch(() => {}); }
      draw(clawX, clawY);
      raf = requestAnimationFrame(loop);
    };
    function draw(cx, cy) {
      g.clearRect(0, 0, W, H);
      // linka chwytaka pod częściami (wcześniej zasłaniała słowo na środku)
      g.fillStyle = 'rgba(159,179,217,.35)'; g.fillRect(cx - 2, 0, 4, cy - 14);
      for (const it of items) {
        if (it.gone) continue;
        const x = it.x - BW / 2, y = it.y - BH / 2;
        g.save();
        if (it.glow) { g.shadowColor = '#38e1ff'; g.shadowBlur = 24; }
        g.fillStyle = it.bad ? '#5a2330' : it.glow ? '#1d6b4a' : '#2a3f78'; roundRect(x, y, BW, BH, 12); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#ff9a3c'; roundRect(x, y, 14, BH, 6); g.fill(); roundRect(x + BW - 14, y, 14, BH, 6); g.fill();
        g.restore();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '700 24px "Segoe UI", system-ui, sans-serif';
        const ic = showIcon && WORDS[it.w]?.icon;
        if (ic) { g.font = '22px system-ui'; g.fillText(ic, it.x, it.y - 13); g.font = '700 20px "Segoe UI", system-ui, sans-serif'; g.fillText(it.w, it.x, it.y + 14); }
        else g.fillText(it.w, it.x, it.y + 1);
      }
      // chwytak
      g.fillStyle = '#ff9a3c'; roundRect(cx - 60, cy - 14, 120, 18, 8); g.fill();
      g.fillStyle = '#38e1ff'; g.fillRect(cx - 60, cy + 4, 10, 20); g.fillRect(cx + 50, cy + 4, 10, 20);
    }
    function roundRect(x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    raf = requestAnimationFrame(loop);
    if (window.__ch1test) window.__ch1test.catch = { cv, items, target };
    const cleanup = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); cv.remove(); tipEl.remove(); };
    try {
      await play(L().slowFirst); paused = false;
      for (;;) {
        const it = await new Promise((res, rej) => { resolveCatch = res; const iv = setInterval(() => { if (!alive) { clearInterval(iv); rej(new Stop()); } }, 300); });
        busy = true;
        const ok = it.w === target;
        const ms = Math.round(performance.now() - t0);
        rec('catch', { item: target, ok, ms, opts: items.length, hint: false, chosen: ok ? null : it.w, attempts: 1 });
        if (ok) { it.gone = true; sfx('part_attach'); await wait(350); cleanup(); await itemDone('catch', target, true); return true; }
        // zła część: zatrzymaj, pokaż właściwą, zagraj obie, wyjaśnij; słowo wróci później
        sfx('wrong'); it.bad = true; paused = true; plOn();
        items.forEach(x => { if (x.w === target) { x.glow = true; x.gone = false; if (x.y < 60 || x.y > H - 80) x.y = H / 2; } });
        tipEl.innerHTML = md(`Trzeba było złapać ${meaning(target)}. Złapałeś ${meaning(it.w)}. Posłuchaj: ${target}, a teraz ${it.w}.`); tipEl.classList.add('on');
        await aegis(nextLine('oops'));
        await play(true); await wait(300); await word(it.w, true); await wait(300); await play(false);
        await nextButton();
        cleanup(); await itemDone('catch', target, false);
        return false;
      }
    } catch (e) { cleanup(); throw e; }
  }

  // 5. Składanie słowa z liter (kafelki lub klawiatura). Polskie wskazówki do typowych błędów.
  GAMES.build = async () => {
    const words = pickItems(M.build, L().n.build, w => w);
    await queue(words, async w => buildRound(w, w.split(''), 'build', ''));
  };

  // Wspólne dla słowa (litery) i zdania (wyrazy).
  async function buildRound(item, tokens, game, sep, extra = {}) {
    const lv = L();
    const isWord = game === 'build';
    const view = isWord ? wordView(item) : h('div', { class: 'ch1-pl-big ch1-plh' }, extra.pl || '');
    header(isWord ? lab('Build the word you hear', 'Ułóż słowo, które słyszysz') : lab('Build the sentence you hear', 'Ułóż zdanie, które słyszysz'), view);
    const slotsEl = h('div', { class: 'ch1-slots' + (isWord ? '' : ' words') });
    const tilesEl = h('div', { class: 'ch1-tiles' });
    const tipEl = h('div', { class: 'ch1-tip' });
    stage.append(slotsEl, tilesEl, tipEl);
    const prefill = isWord ? Math.min(lv.prefill, tokens.length - 1) : 0;
    const slots = tokens.map((t, i) => { const s = h('div', { class: 'ch1-slot' }, i < prefill ? t : ''); slotsEl.append(s); return s; });
    let pos = prefill;
    let pool = tokens.slice(prefill);
    if (isWord) pool.push(...distractorsFor(tokens, lv.distractors));
    else if (extra.distract) pool.push(...extra.distract.slice(0, lv.distractors > 2 ? 2 : 0));
    const tiles = shuffle(pool).map(t => { const b = h('button', { class: 'ch1-tile' + (isWord ? '' : ' word') }, t); b.dataset.t = t; tilesEl.append(b); return b; });
    const play = slow => word(isWord ? item : extra.en, slow);
    setReplay(slow => play(slow).catch(() => {}));
    let errors = 0, hint = false; const wrong = [];
    const t0 = performance.now();
    await play(lv.slowFirst);
    return await new Promise((res, rej) => {
      const iv = setInterval(() => { if (!alive) { clearInterval(iv); cleanupKeys(); rej(new Stop()); } }, 300);
      async function put(b) {
        if (!b || b.disabled) return;
        const need = tokens[pos];
        if (b.dataset.t === need) {
          slots[pos].textContent = need; slots[pos].classList.add('filled'); b.disabled = true; pos++;
          tiles.forEach(x => x.classList.remove('glow'));
          if (pos === tokens.length) {
            clearInterval(iv); cleanupKeys();
            const ok = errors === 0;
            rec(game, { item, ok, ms: Math.round(performance.now() - t0), opts: tiles.length, hint, chosen: wrong[0] || null, errors, wrong: wrong.join(',') || null });
            sfx('correct'); slotsEl.classList.add('ok');
            try { await word(isWord ? item : extra.en, false); await wait(300); await itemDone(game, item, ok); res(ok); } catch (e) { rej(e); }
          }
          return;
        }
        errors++; wrong.push(b.dataset.t); sfx('wrong'); plOn();
        b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400);
        const tip = isWord ? tipFor(need, b.dataset.t) : null;
        if (tip || errors === 1) { tipEl.innerHTML = md(tip || 'Posłuchaj jeszcze raz, powoli.'); tipEl.classList.add('on'); hint = true; }
        if (errors >= 2) { const c = tiles.find(x => !x.disabled && x.dataset.t === need); c && c.classList.add('glow'); hint = true; }
        play(true).catch(() => {});
      }
      tiles.forEach(b => b.onclick = () => put(b));
      const onKey = e => {
        if (!isWord || e.key.length !== 1) return;
        const b = tiles.find(x => !x.disabled && x.dataset.t === e.key.toLowerCase()) || tiles.find(x => !x.disabled && x.dataset.t.toLowerCase() === e.key.toLowerCase());
        if (b) put(b); else { const fake = { dataset: { t: e.key.toLowerCase() }, classList: { add() {}, remove() {} }, disabled: false }; put(fake); }
      };
      window.addEventListener('keydown', onKey);
      function cleanupKeys() { window.removeEventListener('keydown', onKey); }
    });
  }

  // 6. Czytanie: widzisz napis (bez dźwięku), wybierasz znaczenie. Po odpowiedzi słychać słowo.
  GAMES.read = async () => {
    const words = pickItems(M.words, L().n.read, w => w);
    await queue(words, async w => {
      header(lab('Read. What is it?', 'Przeczytaj i wybierz, co to znaczy'), h('div', { class: 'ch1-read' }, w));
      setReplay(null);
      const others = shuffle(M.words.filter(x => x !== w && WORDS[x]?.pl !== WORDS[w]?.pl)).slice(0, L().opts - 1);
      const opts = shuffle([w, ...others]).map(x => ({ key: x, el: h('span', { class: 'ch1-wv' }, WORDS[x]?.icon ? h('span', { class: 'ch1-ico' }, WORDS[x].icon) : null, h('span', { class: 'ch1-pl ch1-plh' }, WORDS[x]?.pl || x)) }));
      const ok = await choice({ game: 'read', item: w, options: opts, correct: w, explain: k => `Tu było napisane ${meaning(w)}. Ty wybrałeś znaczenie słowa ${meaning(k)}.` });
      await word(w, false).catch(() => {});
      return ok;
    });
  };

  // 7. Zdanie: słyszysz zdanie i wybierasz polskie znaczenie. Na poziomie 3 układasz je z wyrazów.
  GAMES.phrase = async () => {
    const all = MISSIONS.flatMap(m => m.phrases || []);
    const items = pickItems(M.phrases, L().n.phrase, p => p.en);
    await queue(items, async p => {
      if (lvl >= 3) {
        const toks = p.en.replace(/[.!?]$/, '').split(' ');
        const distract = shuffle(all.flatMap(x => x.en.replace(/[.!?]$/, '').split(' ')).filter(t => !toks.includes(t))).slice(0, 2);
        return buildRound(p.en, toks, 'phrase', ' ', { en: p.en, pl: p.pl, distract });
      }
      header(lab('What does it mean?', 'Co znaczy to zdanie?'));
      const others = shuffle(all.filter(x => x.pl !== p.pl)).slice(0, Math.min(3, L().opts) - 1);
      const opts = shuffle([p, ...others]).map(x => ({ key: x.en, el: h('span', { class: 'ch1-pl' }, x.pl) }));
      return choice({ game: 'phrase', item: p.en, options: opts, correct: p.en, play: slow => word(p.en, slow), layout: 'col', explain: () => `**${p.en}** = ${p.pl}` });
    });
  };

  // 8. Polecenia (misja 7): słyszysz polecenie, wybierasz czynność robota.
  let cmdRound = 0;
  GAMES.command = async () => {
    const cmds = M.commands || [];
    const n = L().n.command;
    const items = cmdRound++ === 0 ? cmds.slice(0, n) : pickItems(cmds, n, c => c.en);
    await queue(items, async c => {
      header(lab('What should AEGIS-7 do?', 'Co AEGIS-7 ma zrobić?'));
      const others = shuffle(cmds.filter(x => x !== c)).slice(0, L().opts - 1);
      const opts = shuffle([c, ...others]).map(x => ({ key: x.en, el: h('span', { class: 'ch1-wv' }, h('span', { class: 'ch1-ico' }, x.icon), h('span', { class: 'ch1-pl ch1-plh' }, x.pl)) }));
      const ok = await choice({ game: 'command', item: c.en, options: opts, correct: c.en, play: slow => word(c.en, slow), explain: () => `**${c.en}** = ${c.pl} ${c.icon}` });
      const act = h('div', { class: 'ch1-act' }, c.icon); stage.append(act); await wait(700); act.remove();
      return ok;
    });
  };

  // 9. Rozmowa (misja 8): AEGIS-7 pyta, wybierasz odpowiedź (napisaną po angielsku, z 🔊).
  let talkRound = 0;
  GAMES.talk = async () => {
    const t = M.talk || [];
    const first = talkRound++ === 0;
    const items = first ? t.slice(0, 3) : t.slice(3);
    await queue(items, async q => {
      header(lab('Answer AEGIS-7', 'Odpowiedz AEGIS-7'));
      const play = async slow => { await aegis(q.q, { sub: L().plHint }); };
      const opts = shuffle(q.a).slice(0, Math.max(2, Math.min(3, L().opts))).concat([]);
      if (!opts.find(a => a.ok)) opts[0] = q.a.find(a => a.ok);
      const options = shuffle(opts).map(a => {
        const el = h('span', { class: 'ch1-ans' }, h('span', { class: 'ch1-en' }, a.en), h('span', { class: 'ch1-pl ch1-plh' }, a.pl));
        return { key: a.en, el };
      });
      const ok = await choice({ game: 'talk', item: q.q.en, options, correct: q.a.find(a => a.ok).en, play, layout: 'col', explain: () => `AEGIS-7 pyta: **${q.q.en}** = „${q.q.pl}”. Pasuje odpowiedź: **${q.a.find(a => a.ok).en}** = ${q.a.find(a => a.ok).pl}` });
      await word(q.a.find(a => a.ok).en, false).catch(() => {});
      return ok;
    });
  };

  // ---------- mowa: ocena lokalna (window.RGSpeech), bez niej nagraj i odsłuchaj ----------
  async function speechReady(lang) {
    const S = speech();
    if (!S || S.available === false || ctx.profile?.settings?.mic === false) return false;
    if (S.langs && !S.langs.includes(lang)) return false;
    try { return S.ready ? !!(await Promise.race([S.ready(), new Promise(r => setTimeout(() => r(false), 15000))])) : true; } catch (e) { return false; }
  }
  // Dziecko mówi target po angielsku. Do 3 prób; po złej gra mówi, co usłyszała, i daje wskazówkę. Zwraca ok za 1. razem albo null (brak oceny).
  async function speakCheck({ target, game, item, view, tip }) {
    if (!(await speechReady('en'))) return recordOnly(target, view);
    const card = h('div', { class: 'ch1-card' }, view);
    const mic = h('button', { class: 'ch1-next ch1-mic' }, '🎙️ Speak');
    const skip = h('button', { class: 'ch1-ghost' }, 'Skip ›');
    const tipEl = h('div', { class: 'ch1-tip' });
    stage.append(card, h('div', { class: 'ch1-row' }, mic, skip), tipEl);
    setReplay(slow => word(target, slow));
    await word(target, true);
    let tries = 0, firstOk = null, heardFirst = null;
    const t0 = performance.now();
    for (;;) {
      check();
      const act = await new Promise((res, rej) => {
        const iv = setInterval(() => { if (!alive) { clearInterval(iv); rej(new Stop()); } }, 300);
        mic.onclick = () => { clearInterval(iv); res('mic'); }; skip.onclick = () => { clearInterval(iv); res('skip'); };
      });
      if (act === 'skip') break;
      stopAudio(); mic.disabled = true; mic.textContent = '● Listening…'; mic.classList.add('rec');
      let r;
      try { r = await speech().hear('en', { expect: target, maxMs: 4000 }); } catch (e) { r = { err: String(e) }; }
      check();
      mic.disabled = false; mic.classList.remove('rec'); mic.textContent = '🎙️ Again';
      if (r?.err || !r?.alts?.length) {
        if (r?.err === 'not-allowed' || r?.err === 'unsupported') { card.remove(); mic.parentNode.remove(); tipEl.remove(); return recordOnly(target, view); }
        tipEl.innerHTML = md("I didn't hear you. Press 🎙️ and speak loudly."); tipEl.classList.add('on'); continue;
      }
      tries++;
      const m = matchEn(target, r.alts);
      if (tries === 1) { firstOk = m.ok; heardFirst = m.heard; }
      if (m.ok) {
        sfx('correct'); card.classList.add('ok');
        tipEl.innerHTML = md(`✅ I heard: **${m.heard}**`); tipEl.classList.add('on');
        await aegis(nextLine('sayOk'));
        break;
      }
      sfx('wrong'); plOn();
      const hw = normEn(m.heard).join(' ');
      const known = Object.keys(WORDS).find(k => k.toLowerCase() === hw);
      tipEl.innerHTML = md(`Usłyszałem: **${m.heard || '…'}**${known ? ` (${WORDS[known].pl})` : ''}. Powiedz: **${target}**. ${tip || ''}`); tipEl.classList.add('on');
      if (tries >= 3) { await aegis(AEGIS_LINES.together); await word(target, true); await word(target, false); await nextButton(); break; }
      await aegis(AEGIS_LINES.sayAgain); await word(target, true);
    }
    rec(game, { item, ok: !!firstOk, ms: Math.round(performance.now() - t0), opts: 1, hint: tries > 1, chosen: firstOk ? null : heardFirst, attempts: tries, heard: heardFirst });
    card.remove(); stage.querySelector('.ch1-row')?.remove(); tipEl.remove();
    if (tries) await itemDone(game, item, !!firstOk);
    return tries ? !!firstOk : null;
  }
  // Zapas bez oceny: nagraj, odsłuchaj swój głos i wzór (nagrania tylko lokalnie w IndexedDB rg-recordings).
  async function recordOnly(w, view) {
    const card = h('div', { class: 'ch1-card' }, view);
    const note = h('div', { class: 'ch1-hint' }, 'Say it out loud. Then listen to your voice and to AEGIS-7.');
    const can = navigator.mediaDevices?.getUserMedia && window.MediaRecorder && ctx.profile?.settings?.mic !== false;
    const rb = h('button', { class: can ? 'ch1-next' : 'ch1-ghost' }, can ? '🎙️ Record' : '🔊 Listen');
    const skip = h('button', { class: can ? 'ch1-ghost' : 'ch1-next' }, 'Next ›');
    stage.append(card, note, h('div', { class: 'ch1-row' }, rb, skip));
    setReplay(slow => word(w, slow));
    await word(w, true);
    let stream = null;
    try {
      await new Promise((res, rej) => {
        const iv = setInterval(() => { if (!alive) { clearInterval(iv); rej(new Stop()); } }, 300);
        skip.onclick = () => { clearInterval(iv); res(); };
        rb.onclick = async () => {
          if (!can) { word(w, false).catch(() => {}); return; }
          try {
            rb.disabled = true; rb.textContent = '● Speaking…';
            stream = stream || await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream); const chunks = [];
            mr.ondataavailable = e => chunks.push(e.data);
            const stopped = new Promise(r => mr.onstop = r);
            mr.start(); await wait(2500); mr.stop(); await stopped;
            const blob = new Blob(chunks, { type: mr.mimeType });
            saveClip({ t: Date.now(), mission: M.id, item: w, profileId: ctx.profile?.id || null, blob }).catch(() => {});
            rb.textContent = '▶ Your voice'; const a = new Audio(URL.createObjectURL(blob)); curAudio = a;
            await new Promise(r => { a.onended = r; a.onerror = r; a.play().catch(r); });
            rb.textContent = '🔊 AEGIS'; await word(w, false);
            rb.textContent = '🎙️ Again'; rb.disabled = false;
          } catch (e) { if (e instanceof Stop) return; rb.textContent = 'No microphone'; clearInterval(iv); res(); }
        };
      });
    } finally { stream && stream.getTracks().forEach(t => t.stop()); }
    card.remove(); note.remove(); stage.querySelector('.ch1-row')?.remove();
    return null;
  }

  // 10. Powiedz to robotowi: gra słucha i ocenia (lokalnie). Bez rozpoznawania mowy: nagraj i porównaj.
  GAMES.say = async () => {
    const words = pickItems(M.build || M.words, L().n.say, w => w);
    header(lab('Say it to the robot', 'Powiedz to robotowi'));
    await aegis(nextLine('sayAsk'));
    for (const w of words) {
      await speakCheck({ target: w, game: 'say', item: w, view: wordView(w, { big: true, showEn: true }), tip: SOUNDS[M.sound].tipPl });
    }
  };
  GAMES.echo = GAMES.say;

  // 11. Memory: pary słowo angielskie ↔ obrazek z polskim znaczeniem. Odkryte słowo jest czytane.
  GAMES.memory = async () => {
    const pool = (M.words || []).filter(w => WORDS[w]);
    const words = pickItems(pool, Math.min(L().n.memory, pool.length), w => w);
    header(lab('Find the pairs: word and picture', 'Znajdź pary: słowo i obrazek'));
    await aegis(AEGIS_LINES.memoryAsk);
    const cards = shuffle(words.flatMap(w => [{ w, en: true }, { w, en: false }]));
    const grid = h('div', { class: 'ch1-mem' });
    grid.style.setProperty('--cols', cards.length <= 6 ? 3 : cards.length <= 8 ? 4 : 5);
    const missed = new Set(); const t0 = performance.now();
    const els = cards.map(c => {
      const face = c.en ? h('span', { class: 'ch1-mem-en' }, c.w) : h('span', { class: 'ch1-wv' }, h('span', { class: 'ch1-ico' }, WORDS[c.w].icon || ''), h('span', { class: 'ch1-pl ch1-plh' }, WORDS[c.w].pl));
      const b = h('button', { class: 'ch1-mem-card' }, h('span', { class: 'ch1-mem-back' }, '⚙️'), h('span', { class: 'ch1-mem-face' }, face));
      b.card = c; grid.append(b); return b;
    });
    stage.append(grid);
    setReplay(null);
    let open = [], found = 0, lock = false;
    await new Promise((res, rej) => {
      const iv = setInterval(() => { if (!alive) { clearInterval(iv); rej(new Stop()); } }, 300);
      els.forEach(b => b.onclick = async () => {
        if (lock || b.classList.contains('up')) return;
        b.classList.add('up'); open.push(b);
        if (b.card.en) word(b.card.w, false).catch(() => {});
        if (open.length < 2) return;
        lock = true;
        const [x, y] = open; open = [];
        if (x.card.w === y.card.w) {
          x.classList.add('done'); y.classList.add('done'); sfx('correct');
          const w = x.card.w;
          rec('memory', { item: w, ok: !missed.has(w), ms: Math.round(performance.now() - t0), opts: cards.length, hint: false, attempts: 1 });
          try { await word(w, false); await itemDone('memory', w, !missed.has(w)); } catch (e) { clearInterval(iv); return rej(e); }
          if (++found === words.length) { clearInterval(iv); setTimeout(res, 400); }
        } else {
          missed.add(x.card.w); missed.add(y.card.w); sfx('wrong');
          await new Promise(r => setTimeout(r, 1000));
          x.classList.remove('up'); y.classList.remove('up');
        }
        lock = false;
      });
    });
  };

  // 12. Sortowanie do skrzyń: słychać słowo, wkładasz część do skrzyni z właściwym dźwiękiem.
  GAMES.sort = async () => {
    const S = M.sort; if (!S) return;
    const pool = S.groups.flatMap((g, gi) => g.map(w => ({ w, gi })));
    const items = pickItems(pool, L().n.sort, x => x.w);
    header(lab('Which box?', 'Do której skrzyni?'));
    await aegis(AEGIS_LINES.sortAsk);
    await queue(items, async it => {
      header(lab('Listen. Put the part in the right box.', 'Posłuchaj i włóż część do właściwej skrzyni'), h('div', { class: 'ch1-part' }, '🔩'));
      const opts = S.labels.map((lab, gi) => ({ key: String(gi), el: h('span', { class: 'ch1-crate' }, h('span', { class: 'ch1-crate-ico' }, '📦'), h('b', {}, lab), h('small', {}, S.groups[gi].slice(0, 2).join(', ')) ) }));
      const ok = await choice({ game: 'sort', item: it.w, options: opts, correct: String(it.gi), layout: S.labels.length === 2 ? 'two' : '',
        play: slow => word(it.w, slow), contrast: k => word(S.groups[+k][0], true),
        explain: k => `To było ${meaning(it.w)}, więc skrzynia „${S.labels[it.gi]}”. Porównaj z ${S.groups[+k][0]} ze skrzyni „${S.labels[+k]}”.` });
      return ok;
    });
  };

  // 13. Powiedz po polsku: AEGIS-7 mówi albo pisze po angielsku, dziecko odpowiada po polsku (mówi lub wpisuje).
  GAMES.translate = async () => {
    const simple = w => WORDS[w] && plAnswers(w).length && !/[()]/.test(WORDS[w].pl);
    const pool = [...new Set([...(M.words || []), ...(M.build || [])])].filter(simple);
    const items = pickItems(pool, Math.min(L().n.translate, pool.length), w => w);
    header(lab('Say it in Polish', 'Powiedz po polsku'));
    await aegis(AEGIS_LINES.plAsk);
    const plVoice = await speechReady('pl');
    let n = 0;
    await queue(items, async w => {
      const byEar = n++ % 2 === 0; // na zmianę: słuchanie i czytanie
      const accepted = plAnswers(w);
      const rivals = pool.filter(x => x !== w).flatMap(plAnswers);
      header(byEar ? lab('Listen. What is it in Polish?', 'Posłuchaj. Co to znaczy po polsku?') : lab('Read. What is it in Polish?', 'Przeczytaj. Co to znaczy po polsku?'),
        h('div', { class: 'ch1-read' }, byEar && lvl >= 2 ? '🔊' : w));
      const input = h('input', { class: 'ch1-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'in Polish…' });
      const go = h('button', { class: 'ch1-next' }, 'Check');
      const mic = plVoice ? h('button', { class: 'ch1-ghost ch1-mic' }, '🎙️ Say it') : null;
      const tipEl = h('div', { class: 'ch1-tip' });
      stage.append(h('div', { class: 'ch1-row' }, input, go, mic), tipEl);
      setReplay(slow => word(w, slow));
      if (byEar) await word(w, L().slowFirst);
      input.focus();
      const t0 = performance.now();
      const answer = await new Promise((res, rej) => {
        const iv = setInterval(() => { if (!alive) { clearInterval(iv); rej(new Stop()); } }, 300);
        const done = v => { clearInterval(iv); res(v); };
        go.onclick = () => { if (input.value.trim()) done({ text: input.value, how: 'type' }); else input.focus(); };
        input.onkeydown = e => { if (e.key === 'Enter') go.onclick(); };
        if (mic) mic.onclick = async () => {
          mic.disabled = true; mic.textContent = '● Listening…';
          let r; try { r = await speech().hear('pl', { maxMs: 4000 }); } catch (e) { r = { err: 1 }; }
          mic.disabled = false; mic.textContent = '🎙️ Say it';
          if (r?.alts?.length) { const hit = r.alts.find(a => matchPl(accepted, a)); done({ text: hit || r.alts[0], how: 'speak' }); }
          else { tipEl.innerHTML = md("I didn't hear you. Say it again or type it."); tipEl.classList.add('on'); }
        };
      });
      const ok = matchPl(accepted, answer.text, answer.how === 'type' ? rivals : []);
      rec('translate', { item: w, ok, ms: Math.round(performance.now() - t0), opts: 0, hint: false, chosen: ok ? null : answer.text.slice(0, 40), attempts: 1, how: answer.how });
      go.parentNode.remove(); stage.querySelector('.ch1-read')?.after(h('div', { class: 'ch1-pl-big' }, 'Your answer: „' + answer.text.trim() + '”'));
      if (ok) {
        sfx('correct'); tipEl.innerHTML = md(`✅ ${meaning(w)}`); tipEl.classList.add('on');
        await word(w, false); await wait(400);
      } else {
        sfx('wrong'); plOn(); tipEl.innerHTML = md(`${meaning(w)}. Twoja odpowiedź: „${answer.text.trim()}”.`); tipEl.classList.add('on');
        await aegis(nextLine('oops')); await word(w, true);
        await nextButton();
      }
      await itemDone('translate', w, ok);
      return ok;
    });
  };

  // 14. Nowy zwrot: zdanie słowo po słowie z polskim tłumaczeniem, wskazówka, powiedz je, sprawdzenie.
  GAMES.teach = async () => {
    const list = M.teach || [];
    const items = list.slice(0, L().n.teach);
    const allT = MISSIONS.flatMap(m => m.teach || []);
    await aegis(AEGIS_LINES.newPhrase);
    for (const p of items) {
      check();
      const toks = p.en.replace(/[.!?]$/, '').split(' ');
      const chips = toks.map((t, i) => h('span', { class: 'ch1-gl' }, h('b', {}, t), h('small', {}, p.gloss?.[i] || '')));
      header(lab('New phrase', 'Nowy zwrot'),
        h('div', { class: 'ch1-gloss' }, chips), h('div', { class: 'ch1-pl-big' }, '= ' + p.pl),
        p.note ? h('div', { class: 'ch1-soundtip ch1-plh', html: md(p.note) }) : null);
      setReplay(slow => word(p.en, slow));
      await word(p.en, true); await wait(400);
      for (const c of chips) { c.classList.add('lit'); await wait(260); c.classList.remove('lit'); }
      await word(p.en, false);
      await nextButton('Got it ›');
      // powiedz zdanie
      stage.querySelector('.ch1-soundtip')?.remove();
      await speakCheck({ target: p.en, game: 'teach', item: 'say:' + p.en, view: h('div', { class: 'ch1-en-big' }, p.en), tip: 'Mów spokojnie, słowo po słowie.' });
      // sprawdzenie: jak to powiesz po angielsku?
      header(lab('How do you say it in English?', 'Jak to powiesz po angielsku?'), h('div', { class: 'ch1-pl-big' }, p.pl));
      const others = shuffle(allT.filter(x => x.en !== p.en && x.pl !== p.pl)).slice(0, Math.max(1, L().opts - 1));
      const opts = shuffle([p, ...others]).map(x => ({ key: x.en, el: h('span', { class: 'ch1-en' }, x.en) }));
      await choice({ game: 'teach', item: p.en, options: opts, correct: p.en, layout: 'col', explain: () => `**${p.en}** = ${p.pl}` });
      await word(p.en, false).catch(() => {});
    }
  };

  // ---------- odprawa: cel gry, zadania w tej misji, nagroda (po angielsku, prostymi zdaniami) ----------
  const STEP_EN = {
    listen: 'Listen to new words', ear: 'Find the word you hear', letter: 'Find the missing letter', catch: 'Catch the right part',
    build: 'Build words from letters', read: 'Read words', phrase: 'Understand short sentences', command: 'Give orders to the robot',
    talk: 'Talk to AEGIS-7', echo: 'Say words to the robot', say: 'Say words to the robot', memory: 'Play memory',
    sort: 'Sort parts into boxes', translate: 'Say it in Polish', teach: 'Learn new phrases',
  };
  const STEP_ICO = { listen: '👂', ear: '👂', letter: '🔤', catch: '🦾', build: '🧩', read: '📖', phrase: '💬', command: '🕹️', talk: '💬', echo: '🎙️', say: '🎙️', memory: '🃏', sort: '📦', translate: '🇵🇱', teach: '✨' };
  async function briefing() {
    const have = (ctx.profile?.progress?.parts || []).length;
    const total = Object.keys(PARTS).length;
    const partsEn = M.parts.map(p => PARTS_EN[p] || PARTS[p]);
    const steps = [...new Set(M.steps)].filter(x => STEP_EN[x]);
    stage.innerHTML = '';
    const go = h('button', { class: 'ch1-next' }, 'Start mission ›');
    stage.append(h('div', { class: 'ch1-brief' },
      h('div', { class: 'ch1-brief-goal' }, h('b', {}, 'Goal: '), 'Rebuild AEGIS-7, part by part. Then save the family on the space station. ',
        h('span', { class: 'ch1-pl' }, `You have ${have} of ${total} parts.`)),
      h('h2', {}, `Mission ${M.nr}: ${M.titleEn || M.title}`),
      h('div', { class: 'ch1-brief-cols' },
        h('div', {}, h('div', { class: 'ch1-label' }, 'You will:'), h('ol', {}, steps.map(t => h('li', {}, STEP_ICO[t] + ' ' + STEP_EN[t])))),
        h('div', { class: 'ch1-brief-reward' }, h('div', { class: 'ch1-label' }, 'Reward:'),
          M.final ? h('p', {}, '🤖 AEGIS-7 stands up and flies to save the family!')
            : h('p', {}, '🔧 ', h('b', {}, partsEn.join(' and ')), ' for the robot'),
          M.final ? null : h('p', {}, '🖨️ a 3D print file after the mission'))),
      h('div', { class: 'ch1-hint' }, 'No time limit. 🔊 = again. 🐢 = slow.'),
      h('div', { class: 'ch1-row' }, go)));
    await new Promise((res, rej) => { const iv = setInterval(() => { if (!alive) { clearInterval(iv); rej(new Stop()); } }, 300); go.onclick = () => { clearInterval(iv); res(); }; });
  }

  // ---------- przebieg misji ----------
  (async () => {
    try {
      progress(0);
      await briefing();
      header(h('div', { class: 'ch1-soundtitle' }, SOUNDS[M.sound].en || SOUNDS[M.sound].label));
      await aegis(M.intro);
      const steps = M.steps;
      for (let i = 0; i < steps.length; i++) {
        check();
        stage.innerHTML = '';
        setReplay(null);
        await GAMES[steps[i]]();
        progress((i + 1) / steps.length);
        if (i === Math.floor(steps.length / 2) - 1) { stage.innerHTML = ''; await aegis(AEGIS_LINES.halfway); }
        else if (i < steps.length - 1 && i % 3 === 1) { stage.innerHTML = ''; await aegis(nextLine('banter')); }
      }
      stage.innerHTML = '';
      setReplay(null);
      const ratio = stats.items ? stats.firstTry / stats.items : 1;
      const stars = ratio >= 0.85 ? 3 : ratio >= 0.6 ? 2 : 1;
      const hard = [...stats.hard];
      const good = [...stats.good].filter(x => !stats.hard.has(x));
      const line = hard.length ? AEGIS_LINES.summaryHard : AEGIS_LINES.summaryAllGood;
      const summary = {
        missionId: M.id, sound: M.sound, level: lvl, startLevel, items: stats.items, firstTry: stats.firstTry, perSkill: stats.perSkill,
        good, hard, parts: M.parts.slice(), cheer: M.cheer, final: !!M.final,
        en: line.en, pl: line.pl + (hard.length ? ' Trudne: ' + hard.map(x => x.replace(/[.!?]+$/, '')).join(', ') + '.' : ''),
        last: { level: lvl, at: Date.now() },
      };
      try { ctx.audio?.music?.(null); } catch (e) {}
      bubble.classList.remove('on');
      ctx.done?.({ stars, partEarned: M.parts[0] || null, parts: M.parts.slice(), summary });
    } catch (e) {
      if (!(e instanceof Stop)) { console.error(e); stage.innerHTML = ''; stage.append(h('div', { class: 'ch1-tip on' }, 'Coś poszło nie tak. Odśwież stronę.')); }
    }
  })();

  return () => { alive = false; stopAudio(); timers.forEach(clearTimeout); root.innerHTML = ''; };
}

// Polskie wskazówki do typowych pomyłek liter.
function tipFor(need, got) {
  if (!need || !got) return null;
  const k = `${need}>${got}`;
  const map = { 'i>y': 'y_for_i', 'i>ee': 'y_for_i', 't>d': 'd_for_t', 'd>t': 't_for_d', 'a>e': 'e_for_a', 'e>a': 'a_for_e', 'c>k': 'k_for_c', 'h>z': 'sz_for_sh' };
  return map[k] ? SPELL_TIPS[map[k]] : null;
}
const CONFUSE = { i: ['y', 'e'], a: ['e', 'u'], e: ['a', 'i'], t: ['d'], d: ['t'], c: ['k'], s: ['z'], h: ['z'], p: ['b'], b: ['p'], o: ['a', 'u'], u: ['a', 'o'], m: ['n'], n: ['m'], f: ['w'] };
function distractorsFor(letters, n) {
  if (!n) return [];
  const out = [];
  for (const c of shuffle(letters)) for (const d of CONFUSE[c] || []) if (!letters.includes(d) && !out.includes(d)) out.push(d);
  return shuffle(out).slice(0, n);
}

// IndexedDB rg-recordings (wspólna baza nagrań, tylko lokalnie).
function saveClip(clip) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('rg-recordings', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('clips')) r.result.createObjectStore('clips', { autoIncrement: true }); };
    r.onerror = () => rej(r.error);
    r.onsuccess = () => { try { const tx = r.result.transaction('clips', 'readwrite'); tx.objectStore('clips').add(clip); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); } catch (e) { rej(e); } };
  });
}
