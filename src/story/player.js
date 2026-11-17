// Roboguardian – odtwarzacz historii w scenach.
// Lektor mówi po angielsku, na ekranie polski napis (opcjonalnie też angielski).
// Użycie: import { playStory } from './src/story/player.js';
//         const story = await (await fetch('src/story/intro.json')).json();
//         playStory(document.getElementById('app'), story, { onEnd, onMusic, basePath: './' });

const CSS = `
.rgs{position:fixed;inset:0;background:#05070d;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif;color:#fff;z-index:50;user-select:none}
.rgs-img{position:absolute;inset:-4%;background-size:cover;background-position:center;opacity:0;transition:opacity 1.2s ease;will-change:transform,opacity}
.rgs-img.on{opacity:1}
.rgs-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.rgs-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55) 100%),linear-gradient(to bottom,transparent 62%,rgba(0,0,0,.78) 100%)}
.rgs-title{position:absolute;top:18px;left:22px;font-size:14px;letter-spacing:.18em;text-transform:uppercase;color:#3fe0d0;opacity:.9;text-shadow:0 1px 4px #000}
.rgs-sub{position:absolute;left:50%;bottom:86px;transform:translateX(-50%);width:min(92vw,1100px);text-align:center;pointer-events:none}
.rgs-pl{display:inline-block;font-size:clamp(20px,3.1vw,34px);line-height:1.3;font-weight:600;padding:8px 18px;border-radius:12px;background:rgba(5,8,16,.62);text-shadow:0 2px 6px #000;opacity:0;transform:translateY(8px);transition:opacity .35s,transform .35s}
.rgs-pl.on{opacity:1;transform:none}
.rgs-pl.aegis{color:#9ff5ec;border:1px solid rgba(63,224,208,.45)}
.rgs-en{display:block;margin-top:6px;font-size:clamp(14px,1.8vw,20px);color:#ffcf6b;opacity:.9;text-shadow:0 1px 4px #000}
.rgs-who{display:block;font-size:12px;letter-spacing:.2em;color:#3fe0d0;margin-bottom:4px;text-transform:uppercase}
.rgs-bar{position:absolute;left:0;right:0;bottom:16px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap;padding:0 12px}
.rgs-bar button{font:inherit;font-size:16px;font-weight:600;color:#fff;background:rgba(22,33,58,.85);border:2px solid #22345a;border-radius:12px;padding:10px 16px;cursor:pointer;min-height:48px}
.rgs-bar button:hover,.rgs-bar button:focus-visible{border-color:#f08a24;outline:none}
.rgs-bar button.main{background:#f08a24;border-color:#f08a24;color:#16213a}
.rgs-bar button[aria-pressed="true"]{border-color:#3fe0d0;color:#3fe0d0}
.rgs-dots{position:absolute;top:20px;right:22px;display:flex;gap:6px}
.rgs-dots i{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.25)}
.rgs-dots i.done{background:#f08a24}.rgs-dots i.now{background:#3fe0d0;box-shadow:0 0 8px #3fe0d0}
.rgs-start{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}
.rgs-start button{font:inherit;font-size:24px;font-weight:700;padding:18px 36px;border-radius:16px;border:0;background:#f08a24;color:#16213a;cursor:pointer}
@media (max-width:600px){.rgs-bar button{font-size:14px;padding:8px 10px}.rgs-sub{bottom:80px}}
@media (prefers-reduced-motion:reduce){.rgs-img{transition:none}}
`;

const LINE_GAP = 1400;     // przerwa między zdaniami (ms): czas na wsłuchanie się
const SCENE_GAP = 1800;    // cisza po ostatnim zdaniu sceny (ms)
const SCENE_LEAD = 2200;   // nowa scena: najpierw sam obraz i muzyka, potem lektor (ms)

export function playStory(rootEl, data, opts = {}) {
  const base = opts.basePath ?? './';
  const onEnd = opts.onEnd || (() => {});
  const onMusic = opts.onMusic || null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = safeStore();
  let showEn = store.get('rgs.en') === '1';
  let slow = store.get('rgs.slow') === '1';

  if (!document.getElementById('rgs-css')) {
    const st = document.createElement('style'); st.id = 'rgs-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const el = document.createElement('div');
  el.className = 'rgs';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Historia AEGIS-7');
  el.innerHTML = `
    <div class="rgs-img"></div><div class="rgs-img"></div>
    <canvas class="rgs-fx"></canvas><div class="rgs-vig"></div>
    <div class="rgs-title"></div><div class="rgs-dots"></div>
    <div class="rgs-sub" aria-live="polite"><span class="rgs-pl"></span></div>
    <div class="rgs-bar">
      <button data-a="repeat" title="Powtórz zdanie (R)">⟲ Powtórz</button>
      <button data-a="slow" aria-pressed="${slow}" title="Wolniej">🐢 Wolniej</button>
      <button data-a="en" aria-pressed="${showEn}" title="Pokaż też angielski tekst">EN</button>
      <button data-a="next" class="main" title="Dalej (spacja)">Dalej ▶</button>
      <button data-a="skip" title="Pomiń historię (Esc)">Pomiń ⏭</button>
    </div>`;
  rootEl.appendChild(el);

  const imgs = [...el.querySelectorAll('.rgs-img')];
  const canvas = el.querySelector('.rgs-fx');
  const titleEl = el.querySelector('.rgs-title');
  const dotsEl = el.querySelector('.rgs-dots');
  const subEl = el.querySelector('.rgs-pl');
  dotsEl.innerHTML = data.scenes.map(() => '<i></i>').join('');

  const audio = new Audio();
  audio.preload = 'auto';
  const fx = makeFx(canvas, reduced);
  const RG = opts.audio || window.RGAudio || null;   // moduł audio z wątku muzyki (jeśli jest)
  const music = (onMusic || RG) ? null : makeAmbient();
  let loopSfx = null;
  const sfx = (id, o) => { try { return RG && RG.sfx ? RG.sfx(id, o) : null; } catch { return null; } };
  const duck = on => { try { RG && RG.duck && RG.duck(on); } catch { } };
  const stopLoop = () => { Promise.resolve(loopSfx).then(a => a && a.stop && a.stop()).catch(() => {}); loopSfx = null; };

  let si = 0, li = -1, imgFlip = 0, timer = 0, token = 0, finished = false, anim = null;

  // wczytaj z wyprzedzeniem obrazy
  data.scenes.forEach(s => { const i = new Image(); i.src = base + s.image; });

  function setMusic(id) {
    if (onMusic) onMusic(id);
    else if (RG && RG.music) { try { RG.music(id); } catch { } }
    else music && music.set(id);
  }

  function showScene(i) {
    const s = data.scenes[i];
    const layer = imgs[imgFlip ^= 1], other = imgs[imgFlip ^ 1];
    layer.style.backgroundImage = `url("${base + s.image}")`;
    if (anim) { anim.cancel?.(); }
    const m = s.motion || { from: { x: 0, y: 0, scale: 1 }, to: { x: 0, y: 0, scale: 1.08 } };
    const tf = p => `translate(${p.x || 0}%,${p.y || 0}%) scale(${p.scale || 1})`;
    if (!reduced && layer.animate) {
      anim = layer.animate([{ transform: tf(m.from) }, { transform: tf(m.to) }],
        { duration: Math.max(12000, s.lines.length * 7500 + SCENE_LEAD), easing: 'ease-in-out', fill: 'forwards' });
    }
    layer.classList.add('on'); other.classList.remove('on');
    titleEl.textContent = s.title_pl || '';
    [...dotsEl.children].forEach((d, k) => d.className = k < i ? 'done' : k === i ? 'now' : '');
    fx.set(s.fx || 'none');
    stopLoop();
    for (const e of (s.sfx || [])) {
      if (e.loop) loopSfx = sfx(e.id, { loop: true });
      else setTimeout(() => !finished && sfx(e.id), e.at || 0);
    }
    setMusic(s.music || 'story_family');
  }

  function showLine(line) {
    subEl.classList.remove('on', 'aegis');
    const who = line.speaker === 'aegis' ? '<span class="rgs-who">AEGIS-7</span>' : '';
    subEl.innerHTML = who + esc(line.pl) + (showEn ? `<span class="rgs-en" lang="en">${esc(line.en)}</span>` : '');
    if (line.speaker === 'aegis') subEl.classList.add('aegis');
    requestAnimationFrame(() => subEl.classList.add('on'));
  }

  function playLine() {
    const my = ++token;
    clearTimeout(timer);
    const s = data.scenes[si], line = s.lines[li];
    showLine(line);
    if (line.speaker === 'aegis') fx.pulse();
    audio.src = base + line.audio;
    audio.playbackRate = slow ? 0.85 : 1;
    audio.preservesPitch = true;
    const fallback = () => { // brak nagrania: czas wg długości tekstu
      if (my !== token) return;
      timer = setTimeout(() => my === token && advance(), 900 + line.en.split(/\s+/).length * (slow ? 520 : 420));
    };
    duck(true);
    audio.onended = () => { duck(false); if (my === token) timer = setTimeout(advance, LINE_GAP); };
    audio.onerror = fallback;
    const p = audio.play();
    if (p && p.catch) p.catch(err => {
      if (err && err.name === 'NotAllowedError') askToStart(); else fallback();
    });
  }

  function advance() {
    if (finished) return;
    const s = data.scenes[si];
    if (li + 1 < s.lines.length) { li++; playLine(); return; }
    if (si + 1 < data.scenes.length) {
      si++; li = 0;
      subEl.classList.remove('on');
      timer = setTimeout(() => { showScene(si); timer = setTimeout(playLine, SCENE_LEAD); }, SCENE_GAP);
      return;
    }
    finish(false);
  }

  function next() { // przycisk Dalej: przerwij zdanie i przejdź dalej
    if (finished) return;
    token++; clearTimeout(timer); audio.pause();
    const s = data.scenes[si];
    if (li + 1 < s.lines.length) { li++; playLine(); }
    else if (si + 1 < data.scenes.length) { si++; li = 0; showScene(si); timer = setTimeout(playLine, 500); }
    else finish(false);
  }

  function repeat() { if (!finished && li >= 0) { audio.pause(); playLine(); } }

  function askToStart() {
    if (el.querySelector('.rgs-start')) return;
    const ov = document.createElement('div');
    ov.className = 'rgs-start';
    ov.innerHTML = '<button>▶ Rozpocznij historię</button>';
    ov.querySelector('button').onclick = () => { ov.remove(); music && music.resume(); playLine(); };
    el.appendChild(ov);
  }

  function finish(skipped) {
    if (finished) return;
    finished = true; token++; clearTimeout(timer); audio.pause(); duck(false); stopLoop();
    fx.stop(); music && music.stop();
    document.removeEventListener('keydown', onKey);
    el.style.transition = 'opacity .6s'; el.style.opacity = '0';
    setTimeout(() => { el.remove(); onEnd({ skipped }); }, 600);
  }

  function onKey(e) {
    if (e.key === 'Escape') finish(true);
    else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'r' || e.key === 'R') repeat();
  }
  document.addEventListener('keydown', onKey);

  el.querySelector('.rgs-bar').addEventListener('click', e => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'next') next();
    else if (a === 'repeat') repeat();
    else if (a === 'skip') finish(true);
    else if (a === 'slow') { slow = !slow; store.set('rgs.slow', slow ? '1' : '0'); e.target.setAttribute('aria-pressed', slow); audio.playbackRate = slow ? 0.85 : 1; }
    else if (a === 'en') { showEn = !showEn; store.set('rgs.en', showEn ? '1' : '0'); e.target.setAttribute('aria-pressed', showEn); if (li >= 0) showLine(data.scenes[si].lines[li]); }
  });

  // start
  si = 0; li = 0;
  showScene(0);
  timer = setTimeout(playLine, SCENE_LEAD + 600);

  const stop = () => finish(true);
  stop.stop = stop;   // rdzeń woła stop() przy sprzątaniu
  return stop;
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function safeStore() {
  return {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { } }
  };
}

// ---------- efekty na płótnie ----------
function makeFx(canvas, reduced) {
  const ctx = canvas.getContext('2d');
  let mode = 'none', parts = [], raf = 0, t0 = performance.now(), pulseAt = -1e9, running = true;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  function resize() { canvas.width = canvas.clientWidth * DPR; canvas.height = canvas.clientHeight * DPR; }
  resize(); addEventListener('resize', resize);
  const R = (a, b) => a + Math.random() * (b - a);

  function spawn() {
    const W = canvas.width, H = canvas.height;
    parts = [];
    const n = { dust: 60, stars: 90, sparks: 0, lasers: 0, smoke: 26, core: 30, alarm: 0, none: 0 }[mode] ?? 0;
    for (let i = 0; i < n; i++) parts.push({ x: R(0, W), y: R(0, H), r: R(1, 3) * DPR, vx: R(-.15, .15), vy: R(-.3, -.05), a: R(.2, .8), ph: R(0, 6.28) });
    if (mode === 'stars') parts.forEach(p => { p.y = R(0, H * .55); p.r = R(.6, 2) * DPR; });
    if (mode === 'smoke') parts.forEach(p => { p.r = R(60, 160) * DPR; p.a = R(.05, .14); p.vy = R(-.4, -.1); });
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const W = canvas.width, H = canvas.height, t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    if (reduced && mode !== 'alarm') { drawPulse(now, W, H); return; }
    if (mode === 'dust' || mode === 'core') {
      for (const p of parts) {
        p.x += p.vx * DPR; p.y += p.vy * DPR; if (p.y < -10) { p.y = H + 10; p.x = R(0, W); }
        ctx.fillStyle = mode === 'core' ? `rgba(63,224,208,${p.a * (.5 + .5 * Math.sin(t * 2 + p.ph))})` : `rgba(255,214,150,${p.a * .5})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
      if (mode === 'core') {
        const g = ctx.createRadialGradient(W * .5, H * .42, 0, W * .5, H * .42, H * .5);
        g.addColorStop(0, `rgba(63,224,208,${.16 + .08 * Math.sin(t * 2.2)})`); g.addColorStop(1, 'rgba(63,224,208,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    } else if (mode === 'stars') {
      for (const p of parts) { ctx.fillStyle = `rgba(255,255,255,${.25 + .6 * Math.abs(Math.sin(t * .8 + p.ph))})`; ctx.fillRect(p.x, p.y, p.r, p.r); }
    } else if (mode === 'alarm') {
      const a = .10 + .10 * Math.max(0, Math.sin(t * 3.2));
      ctx.fillStyle = `rgba(200,20,40,${a})`; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,.08)'; for (let y = (t * 60 * DPR) % (6 * DPR); y < H; y += 6 * DPR) ctx.fillRect(0, y, W, 1 * DPR);
    } else if (mode === 'lasers') {
      if (Math.random() < .06) parts.push({ kind: 'beam', x: R(W * .5, W), y: R(0, H * .5), tx: R(0, W * .6), ty: R(H * .3, H * .8), life: 1, c: Math.random() < .6 ? '156,255,58' : '190,90,255' });
      if (Math.random() < .3) parts.push({ kind: 'spark', x: R(0, W), y: R(H * .4, H * .85), vx: R(-3, 3), vy: R(-5, -1), life: 1 });
      step();
    } else if (mode === 'sparks') {
      if (Math.random() < .35) { const cx = R(W * .3, W * .7), cy = R(H * .25, H * .6); for (let i = 0; i < 8; i++) parts.push({ kind: 'spark', x: cx, y: cy, vx: R(-6, 6), vy: R(-6, 2), life: 1 }); }
      if (Math.random() < .04) parts.push({ kind: 'beam', x: R(W * .7, W), y: R(0, H * .4), tx: W * .5, ty: H * .45, life: 1, c: '156,255,58' });
      step();
      const g = ctx.createRadialGradient(W * .5, H * .45, 0, W * .5, H * .45, H * .35);
      g.addColorStop(0, `rgba(63,224,208,${.10 + .05 * Math.sin(t * 6)})`); g.addColorStop(1, 'rgba(63,224,208,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (mode === 'smoke') {
      for (const p of parts) {
        p.x += p.vx * DPR; p.y += p.vy * DPR; if (p.y < -p.r) { p.y = H + p.r; p.x = R(0, W); }
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(120,125,140,${p.a})`); g.addColorStop(1, 'rgba(120,125,140,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
    }
    drawPulse(now, W, H);

    function step() {
      parts = parts.filter(p => (p.life -= p.kind === 'beam' ? .06 : .025) > 0);
      for (const p of parts) {
        if (p.kind === 'beam') {
          ctx.strokeStyle = `rgba(${p.c},${p.life})`; ctx.lineWidth = 4 * DPR; ctx.shadowColor = `rgb(${p.c})`; ctx.shadowBlur = 18;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke(); ctx.shadowBlur = 0;
        } else {
          p.x += p.vx * DPR; p.y += p.vy * DPR; p.vy += .2;
          ctx.fillStyle = `rgba(255,${150 + 80 * p.life | 0},60,${p.life})`; ctx.fillRect(p.x, p.y, 3 * DPR, 3 * DPR);
        }
      }
    }
  }

  function drawPulse(now, W, H) { // błysk turkusu, gdy mówi AEGIS-7
    const k = 1 - (now - pulseAt) / 900;
    if (k > 0) { ctx.fillStyle = `rgba(63,224,208,${.12 * k})`; ctx.fillRect(0, 0, W, H); }
  }

  raf = requestAnimationFrame(frame);
  return {
    set(m) { mode = m; spawn(); },
    pulse() { pulseAt = performance.now(); },
    stop() { running = false; cancelAnimationFrame(raf); removeEventListener('resize', resize); }
  };
}

// ---------- prosta muzyka tła: tylko gdy rdzeń nie poda onMusic (podgląd bez modułu audio) ----------
function makeAmbient() {
  let ac; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  const master = ac.createGain(); master.gain.value = 0.0; master.connect(ac.destination);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(master);
  const CH = { // akordy (Hz) dla nastrojów
    story_family: [220, 277.2, 329.6, 440], story_creation: [261.6, 329.6, 392, 493.9],
    story_attack: [110, 164.8, 220, 233.1], story_crash: [196, 233.1, 293.7, 349.2], story_hangar: [174.6, 261.6, 349.2, 440]
  };
  const oscs = [0, 1, 2, 3].map(() => {
    const o = ac.createOscillator(); o.type = 'triangle'; const g = ac.createGain(); g.gain.value = .05;
    o.connect(g); g.connect(lp); o.start(); return o;
  });
  const lfo = ac.createOscillator(); lfo.frequency.value = .15; const lg = ac.createGain(); lg.gain.value = 300; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  return {
    set(mood) {
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      const f = CH[mood] || CH.story_family, t = ac.currentTime;
      oscs.forEach((o, i) => o.frequency.setTargetAtTime(f[i], t, .8));
      lp.frequency.setTargetAtTime(mood === 'story_attack' ? 1600 : mood === 'story_crash' ? 600 : 900, t, .8);
      master.gain.setTargetAtTime(mood === 'story_attack' ? .16 : .12, t, .8);
    },
    resume() { ac.resume().catch(() => {}); },
    stop() { const t = ac.currentTime; master.gain.setTargetAtTime(0, t, .3); setTimeout(() => ac.close().catch(() => {}), 1200); }
  };
}
