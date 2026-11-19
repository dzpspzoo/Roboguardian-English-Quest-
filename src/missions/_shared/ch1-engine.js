// Silnik misji rozdziału 1. Jedna funkcja: runMission(root, ctx, M) -> sprzątanie.
// Zasady: bez kar i presji czasu, angielski głos + polski napis, gra sama ocenia,
// po 1. błędzie „posłuchaj jeszcze raz” + polska wskazówka, po 2. błędzie podświetlenie dobrej odpowiedzi.
import { WORDS, SOUNDS, SPELL_TIPS, AEGIS_LINES, MISSIONS } from './ch1-data.js';
import { slug } from '../../core/say.js';

const CSS_ID = 'ch1-css';
class Stop extends Error {}

// Poziomy trudności (1 łatwy, 2 średni, 3 trudny). Asystent AI może nadpisać każdą wartość.
export const LEVELS = {
  1: { opts: 2, fallSec: 11, plHint: true, slowFirst: true, distractors: 0, prefill: 1, n: { ear: 5, letter: 3, catch: 5, build: 3, read: 3, phrase: 2, command: 4, talk: 3, listen: 4, echo: 2 } },
  2: { opts: 3, fallSec: 8.5, plHint: true, slowFirst: false, distractors: 2, prefill: 0, n: { ear: 6, letter: 4, catch: 6, build: 4, read: 4, phrase: 2, command: 4, talk: 3, listen: 4, echo: 2 } },
  3: { opts: 4, fallSec: 6.5, plHint: false, slowFirst: false, distractors: 4, prefill: 0, n: { ear: 7, letter: 5, catch: 7, build: 4, read: 5, phrase: 3, command: 5, talk: 3, listen: 3, echo: 2 } },
};

const SKILL = {
  listen: s => `phoneme.${s}`, ear: s => `phoneme.${s}`, letter: () => 'phonics', catch: () => 'vocab',
  build: () => 'spelling', read: () => 'reading', phrase: () => 'listening', command: () => 'listening', talk: () => 'dialog', echo: () => 'speaking',
};
const MODE = { ear: 'listen', letter: 'choose', catch: 'choose', build: 'drag', read: 'read', phrase: 'listen', command: 'listen', talk: 'choose', echo: 'speak' };

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
    h('span', { class: 'ch1-pl' }, d.pl || ''));
}

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
  const bHear = h('button', { class: 'ch1-snd', title: 'Posłuchaj' }, '🔊');
  const bSlow = h('button', { class: 'ch1-snd', title: 'Wolniej' }, '🐢');
  const stage = h('div', { class: 'ch1-stage' });
  const subPl = h('div', { class: 'ch1-sub-pl' });
  const bubble = h('div', { class: 'ch1-bubble' }, subPl);
  const buddy = h('img', { src: new URL('./img/aegis-bust.webp', import.meta.url).href, alt: '', class: 'ch1-buddy', 'aria-hidden': 'true', onerror: e => e.target.remove() });
  const wrap = h('div', { class: 'ch1' },
    h('div', { class: 'ch1-top' },
      h('div', { class: 'ch1-title' }, `Misja ${M.nr}: ${M.title}`),
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
    barTxt.textContent = M.parts.length ? `Naprawa: ${p}%` : `Uruchamianie: ${p}%`;
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
    if (sub) { subPl.textContent = line.pl; bubble.classList.add('on'); }
    const myLine = ++lineNo;
    const a = new Audio(`${base}assets/audio/aegis/${slug(line.en)}.wav`);
    curAudio = a;
    const vol = ctx.profile?.settings?.voiceVol; if (typeof vol === 'number') a.volume = vol;
    await new Promise(res => {
      let fell = false;
      const fallback = () => { if (fell) return; fell = true; if (curAudio === a) curAudio = null; Promise.resolve(ctx.say ? ctx.say(line.en, { base }) : null).then(res, res); };
      a.onended = () => res(); a.onerror = fallback; a.onpause = () => res();
      a.play().catch(fallback);
    });
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
    if (firstTry && ++stats.praise % 3 === 0) await aegis(pick(AEGIS_LINES.great));
  }

  // ---------- wspólne: pytanie z wyborem ----------
  // options: [{ key, el }]; correct: key; play: (slow) => Promise; tip: tekst PL po 1. błędzie
  async function choice({ game, item, options, correct, play, tip, layout = '' }) {
    check();
    const box = h('div', { class: 'ch1-opts ' + layout });
    const btns = options.map(o => { const b = h('button', { class: 'ch1-opt' }, o.el); b.dataset.key = o.key; box.append(b); return b; });
    stage.append(box);
    const tipEl = h('div', { class: 'ch1-tip' }); stage.append(tipEl);
    setReplay(play ? (slow => play(slow).catch(() => {})) : null);
    let attempts = 0, hint = false, firstChosen = null, firstMs = 0;
    const nOpts = btns.length;
    const t0 = performance.now();
    if (play) await play(L().slowFirst);
    for (;;) {
      check();
      const key = await new Promise((res, rej) => {
        btns.forEach(b => { b.onclick = () => res(b.dataset.key); });
        const iv = setInterval(() => { if (!alive) { clearInterval(iv); rej(new Stop()); } }, 300);
        btns.forEach(b => b.addEventListener('click', () => clearInterval(iv), { once: true }));
      });
      attempts++;
      const ok = key === String(correct);
      if (attempts === 1) { firstChosen = ok ? null : key; firstMs = Math.round(performance.now() - t0); }
      const b = btns.find(x => x.dataset.key === key);
      if (ok) {
        b.classList.add('ok'); btns.forEach(x => x.disabled = true); sfx('correct');
        rec(game, { item, ok: attempts === 1, ms: firstMs, opts: nOpts, hint: hint || attempts > 1, chosen: firstChosen, attempts });
        await wait(450);
        box.remove(); tipEl.remove();
        await itemDone(game, item, attempts === 1);
        return attempts === 1;
      }
      sfx('wrong'); b.classList.add('bad'); b.disabled = true;
      if (attempts === 1) {
        if (tip) { tipEl.innerHTML = md(tip); tipEl.classList.add('on'); hint = true; }
        await aegis(AEGIS_LINES.again);
        if (play) await play(true);
      } else {
        hint = true;
        btns.forEach(x => { if (x.dataset.key === String(correct)) x.classList.add('glow'); else x.disabled = true; });
        await aegis(AEGIS_LINES.glow);
        if (play) await play(true);
      }
    }
  }

  function header(...kids) { stage.innerHTML = ''; const el = h('div', { class: 'ch1-q' }, ...kids); stage.append(el); return el; }

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
    header(h('div', { class: 'ch1-label' }, 'Posłuchaj'), h('div', { class: 'ch1-soundtip', html: md(tip.tipPl) }));
    const words = M.words.slice(0, L().n.listen);
    for (const w of words) {
      check();
      const card = h('div', { class: 'ch1-card' }, wordView(w, { big: true }));
      stage.querySelector('.ch1-card')?.remove();
      stage.append(card);
      setReplay(slow => word(w, slow));
      await word(w, true); await wait(350); await word(w, false); await wait(600);
    }
    const next = h('button', { class: 'ch1-next' }, 'Dalej ›');
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
      header(h('div', { class: 'ch1-label' }, 'Które słowo słyszysz?'));
      const opts = shuffle(it.pair).map(w => ({ key: w, el: wordView(w, { showEn: lvl >= 3 }) }));
      return choice({ game: 'ear', item: it.target, options: opts, correct: it.target, layout: 'two',
        play: slow => word(it.target, slow), tip: SOUNDS[M.sound].tipPl });
    });
  };

  // 3. Dźwięk i litera: słowo z luką, wybierasz brakującą literę.
  GAMES.letter = async () => {
    const slots = pickItems(M.letterSlots || [], L().n.letter, s => s.w + '#' + s.gap);
    await queue(slots, async s => {
      const letters = s.w.split('');
      const shown = letters.map((c, i) => i === s.gap ? '_' : c).join(' ');
      header(h('div', { class: 'ch1-label' }, 'Jakiej litery brakuje?'), wordView(s.w), h('div', { class: 'ch1-gapword' }, shown));
      const correct = letters[s.gap];
      let opts = s.opts.slice();
      if (L().opts === 2) opts = [correct, opts.find(o => o !== correct)];
      const tip = tipFor(correct, opts.find(o => o !== correct)) || SOUNDS[M.sound].tipPl;
      return choice({ game: 'letter', item: s.w, options: shuffle(opts).map(o => ({ key: o, el: h('span', { class: 'ch1-letter' }, o) })), correct,
        play: slow => word(s.w, slow), tip, layout: 'letters' });
    });
  };

  // 4. Łapanie części: spadają części z napisami, łapiesz tę, którą słyszysz.
  GAMES.catch = async () => {
    const targets = pickItems(M.words, L().n.catch, w => w);
    await queue(targets, async target => {
      header(h('div', { class: 'ch1-label' }, 'Złap część z usłyszanym słowem'));
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
    const showIcon = lvl === 1;
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
      for (const it of items) {
        if (it.gone) continue;
        const x = it.x - BW / 2, y = it.y - BH / 2;
        g.save();
        if (it.glow) { g.shadowColor = '#38e1ff'; g.shadowBlur = 24; }
        g.fillStyle = it.bad ? '#5a2330' : '#2a3f78'; roundRect(x, y, BW, BH, 12); g.fill();
        g.fillStyle = '#ff9a3c'; roundRect(x, y, 14, BH, 6); g.fill(); roundRect(x + BW - 14, y, 14, BH, 6); g.fill();
        g.restore();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '700 24px "Segoe UI", system-ui, sans-serif';
        const ic = showIcon && WORDS[it.w]?.icon;
        if (ic) { g.font = '22px system-ui'; g.fillText(ic, it.x, it.y - 13); g.font = '700 20px "Segoe UI", system-ui, sans-serif'; g.fillText(it.w, it.x, it.y + 14); }
        else g.fillText(it.w, it.x, it.y + 1);
      }
      // chwytak
      g.fillStyle = '#9fb3d9'; g.fillRect(cx - 4, 0, 8, cy - 14);
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
        busy = true; attempts++;
        const ok = it.w === target;
        if (attempts === 1) { firstChosen = ok ? null : it.w; firstMs = Math.round(performance.now() - t0); }
        if (ok) { rec('catch', { item: target, ok: attempts === 1, ms: firstMs, opts: items.length, hint: hint || attempts > 1, chosen: firstChosen, attempts }); it.gone = true; sfx('part_attach'); await wait(350); cleanup(); await itemDone('catch', target, attempts === 1); return attempts === 1; }
        sfx('wrong'); it.bad = true; it.gone = true; paused = true;
        if (attempts === 1) { tipEl.innerHTML = md(`To było <b>${it.w}</b> (${WORDS[it.w]?.pl || ''}). Posłuchaj jeszcze raz.`); tipEl.classList.add('on'); hint = true; await aegis(AEGIS_LINES.again); }
        else { items.forEach(x => { if (x.w === target) x.glow = true; }); hint = true; await aegis(AEGIS_LINES.glow); }
        await play(true); paused = false; busy = false;
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
    const view = isWord ? wordView(item) : h('div', { class: 'ch1-pl-big' }, extra.pl || '');
    header(h('div', { class: 'ch1-label' }, isWord ? 'Ułóż słowo, które słyszysz' : 'Ułóż zdanie, które słyszysz'), view);
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
        errors++; wrong.push(b.dataset.t); sfx('wrong');
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
      header(h('div', { class: 'ch1-label' }, 'Przeczytaj i wybierz, co to znaczy'), h('div', { class: 'ch1-read' }, w));
      setReplay(null);
      const others = shuffle(M.words.filter(x => x !== w && WORDS[x]?.pl !== WORDS[w]?.pl)).slice(0, L().opts - 1);
      const opts = shuffle([w, ...others]).map(x => ({ key: x, el: h('span', { class: 'ch1-wv' }, WORDS[x]?.icon ? h('span', { class: 'ch1-ico' }, WORDS[x].icon) : null, h('span', { class: 'ch1-pl' }, WORDS[x]?.pl || x)) }));
      const ok = await choice({ game: 'read', item: w, options: opts, correct: w, tip: SOUNDS[M.sound].tipPl });
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
      header(h('div', { class: 'ch1-label' }, 'Co znaczy to zdanie?'));
      const others = shuffle(all.filter(x => x.pl !== p.pl)).slice(0, Math.min(3, L().opts) - 1);
      const opts = shuffle([p, ...others]).map(x => ({ key: x.en, el: h('span', { class: 'ch1-pl' }, x.pl) }));
      return choice({ game: 'phrase', item: p.en, options: opts, correct: p.en, play: slow => word(p.en, slow), tip: 'Posłuchaj powoli, słowo po słowie.', layout: 'col' });
    });
  };

  // 8. Polecenia (misja 7): słyszysz polecenie, wybierasz czynność robota.
  let cmdRound = 0;
  GAMES.command = async () => {
    const cmds = M.commands || [];
    const n = L().n.command;
    const items = cmdRound++ === 0 ? cmds.slice(0, n) : pickItems(cmds, n, c => c.en);
    await queue(items, async c => {
      header(h('div', { class: 'ch1-label' }, 'Co AEGIS-7 ma zrobić?'));
      const others = shuffle(cmds.filter(x => x !== c)).slice(0, L().opts - 1);
      const opts = shuffle([c, ...others]).map(x => ({ key: x.en, el: h('span', { class: 'ch1-wv' }, h('span', { class: 'ch1-ico' }, x.icon), h('span', { class: 'ch1-pl' }, x.pl)) }));
      const ok = await choice({ game: 'command', item: c.en, options: opts, correct: c.en, play: slow => word(c.en, slow), tip: 'Posłuchaj powoli. Którego słowa już znasz?' });
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
      header(h('div', { class: 'ch1-label' }, 'Odpowiedz AEGIS-7'));
      const play = async slow => { await aegis(q.q, { sub: L().plHint }); };
      const opts = shuffle(q.a).slice(0, Math.max(2, Math.min(3, L().opts))).concat([]);
      if (!opts.find(a => a.ok)) opts[0] = q.a.find(a => a.ok);
      const options = shuffle(opts).map(a => {
        const el = h('span', { class: 'ch1-ans' }, h('span', { class: 'ch1-en' }, a.en), L().plHint ? h('span', { class: 'ch1-pl' }, a.pl) : null);
        return { key: a.en, el };
      });
      const ok = await choice({ game: 'talk', item: q.q.en, options, correct: q.a.find(a => a.ok).en, play, tip: `AEGIS-7 pyta: „${q.q.pl}”`, layout: 'col' });
      await word(q.a.find(a => a.ok).en, false).catch(() => {});
      return ok;
    });
  };

  // 10. Powiedz to robotowi: nagranie i odsłuch (bez oceny; nagrania tylko lokalnie w IndexedDB rg-recordings).
  GAMES.echo = async () => {
    if (ctx.profile?.settings?.mic === false || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return;
    const words = shuffle(M.build || M.words).slice(0, L().n.echo);
    header(h('div', { class: 'ch1-label' }, 'Powiedz to robotowi'));
    await aegis(AEGIS_LINES.echoAsk);
    let stream = null;
    try {
      for (const w of words) {
        check();
        const card = h('div', { class: 'ch1-card' }, wordView(w, { big: true, showEn: true }));
        const rb = h('button', { class: 'ch1-next' }, '🎙️ Nagraj');
        const skip = h('button', { class: 'ch1-ghost' }, 'Dalej ›');
        stage.querySelector('.ch1-card')?.remove(); stage.querySelector('.ch1-row')?.remove();
        stage.append(card, h('div', { class: 'ch1-row' }, rb, skip));
        setReplay(slow => word(w, slow));
        await word(w, true);
        await new Promise((res, rej) => {
          const iv = setInterval(() => { if (!alive) { clearInterval(iv); rej(new Stop()); } }, 300);
          skip.onclick = () => { clearInterval(iv); res(); };
          rb.onclick = async () => {
            try {
              rb.disabled = true; rb.textContent = '● Mówię…';
              stream = stream || await navigator.mediaDevices.getUserMedia({ audio: true });
              const mr = new MediaRecorder(stream); const chunks = [];
              mr.ondataavailable = e => chunks.push(e.data);
              const stopped = new Promise(r => mr.onstop = r);
              mr.start(); await wait(2500); mr.stop(); await stopped;
              const blob = new Blob(chunks, { type: mr.mimeType });
              saveClip({ t: Date.now(), mission: M.id, item: w, profileId: ctx.profile?.id || null, blob }).catch(() => {});
              rb.textContent = '▶ Twój głos'; const a = new Audio(URL.createObjectURL(blob)); curAudio = a;
              await new Promise(r => { a.onended = r; a.onerror = r; a.play().catch(r); });
              rb.textContent = '🔊 AEGIS'; await word(w, false);
              rb.textContent = '🎙️ Jeszcze raz'; rb.disabled = false;
            } catch (e) { if (e instanceof Stop) return; rb.textContent = 'Mikrofon niedostępny'; clearInterval(iv); res(); }
          };
        });
      }
    } finally { stream && stream.getTracks().forEach(t => t.stop()); }
  };

  // ---------- przebieg misji ----------
  (async () => {
    try {
      progress(0);
      header(h('div', { class: 'ch1-soundtitle' }, SOUNDS[M.sound].label));
      await aegis(M.intro);
      const steps = M.steps;
      for (let i = 0; i < steps.length; i++) {
        check();
        stage.innerHTML = '';
        setReplay(null);
        await GAMES[steps[i]]();
        progress((i + 1) / steps.length);
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
