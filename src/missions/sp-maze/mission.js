// Misja specjalna: Lot przez labirynt. Prosta gra 2D przed sprawdzianem, inna niż misje fabularne.
// AEGIS-7 leci tunelem, z prawej nadlatują bramki ze słowami. Dziecko zmienia tor (strzałki, W/S, dotyk)
// i wlatuje w bramkę z angielskim słowem pasującym do polskiego słowa albo do usłyszanego dźwięku.
// Za dobrą bramkę ratuje zwierzaka. Zła bramka: odbicie, dobra świeci, gra mówi oba słowa; słowo wraca później.
import { createShell, chooseWords, starsFor } from '../_shared/special-engine.js';
import { LINES } from '../_shared/special-data.js';

export const meta = {
  id: 'sp-maze', title: 'Lot przez labirynt', titleEn: 'Maze flight', chapter: 1, special: true, icon: '🚀',
  desc: 'Gra przed sprawdzianem: AEGIS-7 leci przez labirynt, a Ty wybierasz bramki z dobrymi słowami i ratujesz zwierzęta.',
  part: null, parts: [], skills: ['vocab', 'listening'], minutes: 8, requires: [],
};

const ANIMALS = [
  ['🐼', 'panda', 'panda'], ['🦊', 'fox', 'lis'], ['🐨', 'koala', 'koala'], ['🐯', 'tiger', 'tygrys'], ['🦁', 'lion', 'lew'],
  ['🐸', 'frog', 'żaba'], ['🐵', 'monkey', 'małpa'], ['🐧', 'penguin', 'pingwin'], ['🦉', 'owl', 'sowa'], ['🐢', 'turtle', 'żółw'],
  ['🐬', 'dolphin', 'delfin'], ['🦒', 'giraffe', 'żyrafa'], ['🐘', 'elephant', 'słoń'], ['🦓', 'zebra', 'zebra'], ['🦔', 'hedgehog', 'jeż'],
  ['🐙', 'octopus', 'ośmiornica'], ['🦜', 'parrot', 'papuga'], ['🐺', 'wolf', 'wilk'], ['🦘', 'kangaroo', 'kangur'], ['🐻‍❄️', 'polar bear', 'niedźwiedź polarny'],
];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function mount(root, ctx) {
  const S = createShell(root, ctx, { id: meta.id, title: meta.titleEn || meta.title });
  (async () => {
    try {
      S.progress(0, 'Wybór działu');
      const sel = await chooseWords(S, { allowHardest: true, intro: 'Jakie słowa w labiryncie?' });
      const words = sel.words.filter(w => w.en).slice();
      const res = await flyGame(S, words, { unitId: sel.unitId, max: 12 });
      S.progress(1, `Maze: ${res.ok} / ${res.total}`);
      S.clear(S.h('div', { class: 'sp-score' }, `${res.ok} / ${res.total}`), S.h('div', { class: 'ch1-label' }, 'good gates on the first try'),
        S.h('div', { class: 'mz-zoo' }, res.saved.map(a => S.h('span', { title: `${a[1]} = ${a[2]}` }, a[0]))),
        S.h('div', { class: 'ch1-hint' }, `Animals saved: ${res.saved.length}`),
        res.wrong.length ? S.h('div', { class: 'ch1-tip on' }, 'Practise again: ', S.h('b', {}, res.wrong.join(', '))) : null);
      await S.aegis(LINES.mazeEnd);
      const next = S.h('button', { class: 'ch1-next' }, 'Next ›'); S.stage.append(next); await S.clickOf([next]);
      const line = res.ok === res.total ? LINES.great : LINES.testGood;
      ctx.done?.({ stars: starsFor(res.ok, res.total), partEarned: false, parts: [], summary: {
        missionId: meta.id, unit: sel.unitId, unitTitle: sel.title, good: res.good, hard: res.wrong, saved: res.saved.map(a => a[1]),
        cheer: LINES.mazeEnd, en: line.en, pl: `${line.pl} Wynik: ${res.ok} z ${res.total}. Uratowane zwierzęta: ${res.saved.length}.`,
      } });
    } catch (e) { S.error(e); }
  })();
  return S.cleanup;
}

// Sama gra, do użycia też w innych miejscach (np. Misja dnia). words: [{ en, pl, icon }].
// Zwraca { ok, total, good, wrong, saved }.
export async function flyGame(S, words, { unitId = null, max = 12 } = {}) {
  const { h } = S;
  const lvl = S.lvl;
  const lanesN = Math.min(words.length, lvl === 1 ? 2 : lvl === 2 ? 3 : 4);
  const travel = lvl === 1 ? 9 : lvl === 2 ? 7.5 : 6; // sekundy od pojawienia się bramek do AEGIS-7
  const list = shuffle(words).slice(0, max);
  const queue = list.map(w => ({ w, again: false }));
  const animals = shuffle(ANIMALS);
  const saved = [], good = [], wrong = [];
  let ok = 0, n = 0;

  // instrukcja
  S.clear(h('div', { class: 'ch1-label' }, 'Maze flight'),
    h('div', { class: 'ch1-soundtip' }, 'Look at the word at the top, or listen. Fly to the gate with the right English word. ',
      h('b', {}, '↑ ↓'), ' or ', h('b', {}, 'tap a lane'), '. Every good gate saves an animal! 🐼🦊🐧'));
  await S.aegis(LINES.mazeIntro);
  const go = h('button', { class: 'ch1-next' }, 'Start ›'); S.stage.append(h('div', { class: 'ch1-row' }, go)); await S.clickOf([go]);

  // scena
  S.clear();
  const prompt = h('div', { class: 'mz-prompt' });
  const cv = h('canvas', { class: 'mz-cv' });
  const zoo = h('div', { class: 'mz-zoo small' });
  const tip = h('div', { class: 'ch1-tip mz-tip' });
  const wrap = h('div', { class: 'mz-wrap' }, prompt, cv, tip, zoo);
  S.stage.append(wrap);
  const g = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  const resize = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize(); window.addEventListener('resize', resize);
  const bot = new Image(); bot.src = new URL('../_shared/img/aegis-bust.webp', import.meta.url).href;
  const laneY = i => H * (i + 0.5) / lanesN;
  let lane = Math.floor(lanesN / 2), shipY = 0, gates = null, stars = [], paused = true, bump = 0, t = 0, sparks = [];
  const keys = e => {
    if (['ArrowUp', 'w', 'W'].includes(e.key)) { lane = Math.max(0, lane - 1); e.preventDefault(); }
    if (['ArrowDown', 's', 'S'].includes(e.key)) { lane = Math.min(lanesN - 1, lane + 1); e.preventDefault(); }
  };
  window.addEventListener('keydown', keys);
  cv.onpointerdown = e => { const r = cv.getBoundingClientRect(); lane = Math.max(0, Math.min(lanesN - 1, Math.floor((e.clientY - r.top) / (H / lanesN)))); };
  let resolveGate = null;
  let raf = 0, last = performance.now();
  const loop = now => {
    if (!S.alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const shipX = Math.max(70, W * 0.12);
    const ty = laneY(lane); shipY += (ty - shipY) * Math.min(1, dt * 10);
    if (!paused && gates) {
      gates.x -= (W - shipX) / travel * dt;
      if (gates.x <= shipX + 40 && !gates.hit) { gates.hit = true; resolveGate && resolveGate(lane); }
    }
    for (const s of stars) { if (!paused) s.x -= (W / 6) * dt; if (!s.got && Math.abs(s.x - shipX) < 30 && Math.abs(laneY(s.lane) - shipY) < H / lanesN / 2) { s.got = true; sparks.push({ x: s.x, y: laneY(s.lane), t: 0 }); S.sfx('click'); } }
    stars = stars.filter(s => s.x > -40 && !s.got);
    draw(shipX);
    raf = requestAnimationFrame(loop);
  };
  function rr(x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function draw(shipX) {
    g.clearRect(0, 0, W, H);
    // tunel: ściany i przesuwające się pasy (wrażenie lotu)
    const off = (t * (paused ? 20 : 160)) % 80;
    g.fillStyle = 'rgba(56,225,255,.08)';
    for (let i = 1; i < lanesN; i++) g.fillRect(0, H * i / lanesN - 1, W, 2);
    g.fillStyle = 'rgba(255,154,60,.35)';
    for (let x = -off; x < W; x += 80) { g.fillRect(x, 0, 40, 6); g.fillRect(x, H - 6, 40, 6); }
    for (const s of stars) { g.font = '28px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⭐', s.x, laneY(s.lane)); }
    if (gates) {
      const gw = Math.min(200, W * 0.22), gh = Math.min(70, H / lanesN - 14);
      gates.items.forEach((it, i) => {
        const y = laneY(i) - gh / 2;
        g.save();
        if (it.glow) { g.shadowColor = '#4be38a'; g.shadowBlur = 30; }
        g.fillStyle = it.bad ? '#5a2330' : it.glow ? '#1d6b4a' : '#24386c'; rr(gates.x, y, gw, gh, 14); g.fill();
        g.strokeStyle = it.glow ? '#4be38a' : '#ff9a3c'; g.lineWidth = 4; g.stroke();
        g.restore();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${Math.min(30, gw / Math.max(4, it.w.en.length) * 1.6)}px system-ui, sans-serif`;
        g.fillText(it.w.en, gates.x + gw / 2, laneY(i) + 1);
      });
    }
    // AEGIS-7
    const bw = Math.min(110, H / lanesN * 1.1), bh = bw * 400 / 480;
    const wob = Math.sin(t * 4) * 3 + (bump > 0 ? Math.sin(bump * 30) * 10 : 0);
    if (bump > 0) bump = Math.max(0, bump - 0.016);
    g.fillStyle = 'rgba(56,225,255,.5)'; g.beginPath(); g.ellipse(shipX - bw * 0.55, shipY + wob, 18 + Math.random() * 8, 7, 0, 0, Math.PI * 2); g.fill();
    if (bot.complete && bot.naturalWidth) g.drawImage(bot, shipX - bw / 2, shipY - bh / 2 + wob, bw, bh); else { g.font = `${bw * .6}px system-ui`; g.fillText('🤖', shipX, shipY + wob); }
    for (const s of sparks) { s.t += 0.03; g.globalAlpha = Math.max(0, 1 - s.t); g.font = '30px system-ui'; g.fillText('✨', s.x, s.y - s.t * 40); g.globalAlpha = 1; }
    sparks = sparks.filter(s => s.t < 1);
  }
  raf = requestAnimationFrame(loop);
  const cleanup = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', keys); window.removeEventListener('resize', resize); };
  S.onDestroy(cleanup);
  if (window.__ch1test) window.__ch1test.maze = { get gates() { return gates; }, get lanesN() { return lanesN; }, setLane: i => { lane = i; } };

  try {
    while (queue.length) {
      S.check();
      const { w, again } = queue.shift();
      const byEar = n++ % 2 === 1; // na zmianę: polskie słowo na ekranie albo angielskie ze słuchu
      const others = shuffle(words.filter(x => x.en !== w.en && x.pl !== w.pl)).slice(0, lanesN - 1);
      const items = shuffle([w, ...others]).map(x => ({ w: x, bad: false, glow: false }));
      S.progress((list.length - queue.length - 1) / list.length, `Maze: ${Math.min(n, list.length)} / ${list.length}`);
      prompt.replaceChildren(byEar ? h('span', {}, '🔊 Listen and fly to this word') : h('span', {}, w.icon ? h('span', { class: 'mz-ico' }, w.icon) : null, h('b', {}, w.pl || w.en)));
      tip.classList.remove('on');
      S.setReplay(slow => S.word(w.en, slow));
      gates = { x: W + 20, items, hit: false };
      if (Math.random() < 0.7) stars.push({ x: W + 20 - W * 0.5, lane: Math.floor(Math.random() * lanesN), got: false });
      paused = true;
      if (byEar) await S.word(w.en, S.slowFirst).catch(() => {}); else await S.wait(500);
      paused = false;
      const t0 = performance.now();
      const chosen = await new Promise((res, rej) => { resolveGate = res; const iv = setInterval(() => { if (!S.alive) { clearInterval(iv); rej(new Error('stop')); } }, 300); const r0 = res; resolveGate = v => { clearInterval(iv); r0(v); }; });
      paused = true;
      const pickW = items[chosen]?.w;
      const good1 = pickW && pickW.en === w.en;
      S.rec(unitId, { item: w.en, skill: 'vocab', mode: byEar ? 'listen' : 'choose', game: 'maze', ok: good1, ms: Math.round(performance.now() - t0), opts: lanesN, hint: false, chosen: good1 ? null : pickW?.en || null, attempts: 1 });
      if (good1) {
        items[chosen].glow = true; S.sfx('correct');
        if (!again) ok++;
        good.push(w.en);
        const a = animals[saved.length % animals.length]; saved.push(a);
        zoo.append(h('span', { class: 'mz-new', title: `${a[1]} = ${a[2]}` }, a[0]));
        tip.innerHTML = `${a[0]} You saved a <b>${a[1]}</b>!`; tip.classList.add('on');
        await S.word(w.en, false).catch(() => {});
        if (saved.length === 1) await S.aegis(LINES.mazeSave);
        await S.wait(700);
      } else {
        bump = 0.6; S.sfx('wrong');
        if (items[chosen]) items[chosen].bad = true;
        items.forEach(it => { if (it.w.en === w.en) it.glow = true; });
        S.stage.classList.add('pl-on'); tip.innerHTML = `Dobra bramka: <b>${w.en}</b> = ${w.pl || ''} ${w.icon || ''}` + (pickW ? `. Ty wleciałeś w <b>${pickW.en}</b> = ${pickW.pl || ''}.` : '.');
        tip.classList.add('on');
        await S.aegis(LINES.mazeBump);
        await S.word(w.en, true).catch(() => {});
        if (pickW) { await S.wait(250); await S.word(pickW.en, true).catch(() => {}); }
        if (!again) { wrong.push(w.en); queue.push({ w, again: true }); }
        const nb = h('button', { class: 'ch1-next' }, 'Fly on ›'); const row = h('div', { class: 'ch1-row' }, nb); wrap.append(row); await S.clickOf([nb]); row.remove();
      }
      gates = null;
    }
  } finally { cleanup(); }
  return { ok, total: list.length, good: good.filter(x => !wrong.includes(x)), wrong, saved };
}
