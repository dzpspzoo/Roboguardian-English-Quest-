// Test startowy (kalibracja) Roboguardian English Quest.
// Fabularnie: AEGIS-7 „skanuje komunikator”, żeby wiedzieć, jak pomagać graczowi.
// Wejście i wyjście opisuje docs/ARCHITEKTURA.md oraz src/calibration/README.md.

import { say as coreSay } from '../core/say.js';
import { content } from './content.js';
import { buildResult, classifySpelling, eventSkill, describeForParent } from './scoring.js';
import { Mic, saveClip, sleep } from './recorder.js';

export { describeForParent };

const LEVEL_NUM = { A: 1, B: 2, C: 3 };
class Aborted extends Error {}

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

let cssLoaded = false;
function loadCss() {
  if (cssLoaded) return; cssLoaded = true;
  const l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = new URL('./calibration.css', import.meta.url).href;
  document.head.appendChild(l);
}

/**
 * startCalibration({ root, profile, audioBase, record, onComplete, onExit, sayFn })
 *  - root: element, w którym rysujemy test
 *  - profile: profil dziecka ({ id, name, settings })
 *  - audioBase: prefiks ścieżek do assets/ (np. '' na stronie głównej, '../../' z podstrony)
 *  - record(event): zapis każdej odpowiedzi (format asystenta)
 *  - onComplete(result): wynik "roboguardian.calibration/1"
 *  - onExit(): opcjonalnie, rodzic przerwał test
 * Zwraca funkcję sprzątającą.
 */
export function startCalibration({ root, profile = {}, audioBase = '', record = () => {}, onComplete = () => {}, onExit, sayFn } = {}) {
  loadCss();
  const say = sayFn || ((text, opts = {}) => coreSay(text, { base: audioBase, ...opts }));
  const mic = new Mic();
  const items = [];
  const context = {
    age: null, schoolYears: null, hasTablet: !!(profile.settings && profile.settings.tablet),
    micOk: false, audioOk: null,
    device: { touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0, w: window.innerWidth, h: window.innerHeight }
  };
  const startedAt = new Date().toISOString();
  const session = 'cal' + Date.now().toString(36);
  let alive = true, breakTaken = false, answered = 0;
  const sectionModes = {};

  // ---------- szkielet ekranu ----------
  root.innerHTML = '';
  const wrap = el('div', 'rgc');
  wrap.innerHTML = `
    <div class="rgc-top">
      <div class="rgc-title">SKAN KOMUNIKATORA</div>
      <div class="rgc-bar"><div class="rgc-bar-fill"></div></div>
      <div class="rgc-pct">0%</div>
      ${onExit ? '<button class="rgc-exit" title="Przerwij test (dla rodzica)">✕</button>' : ''}
    </div>
    <div class="rgc-stage"></div>
    <div class="rgc-sub rgc-bubble" aria-live="polite"></div>
    <img class="rgc-buddy" src="${audioBase}src/missions/_shared/img/aegis-bust.webp" alt="AEGIS-7" onerror="this.src='${audioBase}assets/img/aegis.webp'">`;
  root.appendChild(wrap);
  const stage = wrap.querySelector('.rgc-stage');
  const sub = wrap.querySelector('.rgc-sub');
  const barFill = wrap.querySelector('.rgc-bar-fill');
  const pct = wrap.querySelector('.rgc-pct');
  if (onExit) wrap.querySelector('.rgc-exit').onclick = () => { if (confirm('Przerwać test? Wynik nie zostanie zapisany.')) { cleanup(); onExit(); } };

  function check() { if (!alive) throw new Aborted(); }
  // Limit czasu na wypadek, gdy syntezator przeglądarki nie zgłosi końca (znany błąd Chrome).
  async function speak(text, opts = {}) {
    check();
    const limit = 2500 + String(text).length * (opts.slow ? 160 : 100);
    wrap.classList.add('rgc-talking');
    try { await Promise.race([say(text, opts), sleep(limit)]); } catch (e) {}
    wrap.classList.remove('rgc-talking');
    check();
  }
  async function line(l, opts) { sub.textContent = l.pl; await speak(l.en, opts); }

  // postęp: każda część ma równy udział
  const parts = content.sections.filter(s => s.key !== 'break').map(s => s.key);
  const maxPer = { words: 9, contrasts: content.contrastItems.length, phonics: content.phonicsItems.length, reading: 9, listening: 9, spelling: 9, speaking: content.speakingItems.length };
  function progress(sectionKey, done) {
    const i = parts.indexOf(sectionKey);
    const frac = i < 0 ? 1 : (i + Math.min(1, done / (maxPer[sectionKey] || 1))) / parts.length;
    const p = Math.round(frac * 100);
    barFill.style.width = p + '%'; pct.textContent = p + '%';
  }

  function blip() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; const c = blip.c || (blip.c = new AC());
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.16);
    } catch (e) {}
  }

  // ---------- zapis odpowiedzi ----------
  function store(it) {
    items.push(it);
    answered++;
    const ev = {
      session, mission: 'calibration', item: it.id, skill: eventSkill(it.section, it.contrast),
      mode: it.mode, ok: it.correct, ms: it.rtMs, opts: it.shown ? it.shown.length : 0, hint: false,
      chosen: it.answer, level: it.level ? LEVEL_NUM[it.level] : null,
      replays: it.replays || 0, slow: !!it.slowUsed, errorType: it.errorType || null
    };
    try { record(ev); } catch (e) { console.warn('record', e); }
  }

  async function feedback() {
    blip();
    if (answered % 5 === 0) { const l = pick(content.lines.gotIt); sub.textContent = l.pl; await speak(l.en); }
    else await sleep(350);
  }

  // ---------- ekrany ----------
  // Pytanie z wyborem. prompt(slow) odtwarza polecenie. Zwraca { key, rtMs, replays, slowUsed }.
  function askChoice({ options, prompt, text, cls = '', subtitle }) {
    return new Promise((resolve, reject) => {
      stage.innerHTML = '';
      if (subtitle != null) sub.textContent = subtitle;
      const box = el('div', 'rgc-q ' + cls);
      if (text) box.appendChild(el('div', 'rgc-read', esc(text)));
      const row = el('div', 'rgc-opts');
      const btns = options.map(o => {
        const b = el('button', 'rgc-opt' + (o.isText ? ' rgc-opt-text' : ''));
        b.innerHTML = o.isText ? esc(o.label) : `<span class="rgc-emoji">${o.emoji}</span>${o.caption ? `<span class="rgc-cap">${esc(o.caption)}</span>` : ''}`;
        b.dataset.key = o.key;
        row.appendChild(b); return b;
      });
      box.appendChild(row);
      const tools = el('div', 'rgc-tools');
      let replays = 0, slowUsed = false, t0 = performance.now(), busy = false;
      if (prompt) {
        const rep = el('button', 'rgc-tool', '🔊<span>Jeszcze raz</span>');
        const slow = el('button', 'rgc-tool', '🐢<span>Wolniej</span>');
        rep.onclick = () => play(false, true); slow.onclick = () => { slowUsed = true; play(true, true); };
        tools.append(rep, slow);
      }
      box.appendChild(tools);
      stage.appendChild(box);
      async function play(slow, isReplay) {
        if (busy) return; busy = true; if (isReplay) replays++;
        try { await prompt(slow, btns); } catch (e) { if (e instanceof Aborted) return reject(e); }
        busy = false; if (!isReplay) t0 = performance.now();
      }
      btns.forEach(b => b.onclick = () => {
        if (!alive) return;
        btns.forEach(x => x.disabled = true); b.classList.add('rgc-picked');
        resolve({ key: b.dataset.key, rtMs: Math.round(performance.now() - t0), replays, slowUsed });
      });
      if (prompt) play(false, false); else t0 = performance.now();
    });
  }

  function askTiles({ word, extra, prompt }) {
    return new Promise((resolve, reject) => {
      stage.innerHTML = '';
      const box = el('div', 'rgc-q');
      const slots = el('div', 'rgc-slots');
      const tilesRow = el('div', 'rgc-tiles');
      const letters = shuffle([...word.replace(/ /g, '')].concat(extra));
      const picked = [];
      const tiles = letters.map((ch, i) => {
        const t = el('button', 'rgc-tile', esc(ch)); t.dataset.i = i;
        t.onclick = () => { if (t.disabled) return; t.disabled = true; picked.push(i); draw(); };
        tilesRow.appendChild(t); return t;
      });
      function draw() {
        slots.innerHTML = '';
        const n = Math.max(word.length, picked.length);
        for (let k = 0; k < n; k++) {
          const s = el('button', 'rgc-slot' + (picked[k] != null ? ' full' : ''), picked[k] != null ? esc(letters[picked[k]]) : '');
          if (picked[k] != null) s.onclick = () => { tiles[picked[k]].disabled = false; picked.splice(k, 1); draw(); };
          slots.appendChild(s);
        }
        ok.disabled = picked.length === 0;
      }
      const tools = el('div', 'rgc-tools');
      const rep = el('button', 'rgc-tool', '🔊<span>Jeszcze raz</span>');
      const slow = el('button', 'rgc-tool', '🐢<span>Wolniej</span>');
      const back = el('button', 'rgc-tool', '⌫<span>Cofnij</span>');
      const ok = el('button', 'rgc-tool rgc-ok', '✓<span>Gotowe</span>');
      tools.append(rep, slow, back, ok);
      box.append(slots, tilesRow, tools); stage.appendChild(box);
      let replays = 0, slowUsed = false, t0 = performance.now(), busy = false;
      async function play(s, isReplay) {
        if (busy) return; busy = true; if (isReplay) replays++;
        try { await prompt(s); } catch (e) { if (e instanceof Aborted) return reject(e); }
        busy = false; if (!isReplay) t0 = performance.now();
      }
      rep.onclick = () => play(false, true);
      slow.onclick = () => { slowUsed = true; play(true, true); };
      back.onclick = () => { const i = picked.pop(); if (i != null) tiles[i].disabled = false; draw(); };
      const keyH = e => {
        if (!alive) return;
        if (e.key === 'Backspace') { back.onclick(); e.preventDefault(); return; }
        if (e.key === 'Enter' && picked.length) { ok.onclick(); return; }
        const k = e.key.toLowerCase();
        const t = tiles.find((x, i) => !x.disabled && letters[i] === k); if (t) t.onclick();
      };
      document.addEventListener('keydown', keyH);
      ok.onclick = () => {
        document.removeEventListener('keydown', keyH);
        [...tiles, rep, slow, back, ok].forEach(b => b.disabled = true);
        resolve({ answer: picked.map(i => letters[i]).join(''), rtMs: Math.round(performance.now() - t0), replays, slowUsed });
      };
      draw();
      play(false, false);
    });
  }

  function waitButton(label, { delayMs = 0, cls = '' } = {}) {
    return new Promise(resolve => {
      const b = el('button', 'rgc-next ' + cls, label);
      b.style.visibility = delayMs ? 'hidden' : 'visible';
      stage.appendChild(b);
      if (delayMs) setTimeout(() => { b.style.visibility = 'visible'; }, delayMs);
      b.onclick = () => { b.disabled = true; resolve(); };
    });
  }

  function aegisScreen(extraHtml = '') {
    // AEGIS-7 stoi w rogu ekranu (.rgc-buddy), tu tylko tytuł skanu i ewentualne elementy (mikrofon, ładowanie)
    const t = wrap.querySelector('.rgc-title').textContent;
    stage.innerHTML = `<div class="rgc-scan"><div class="rgc-scan-ring"></div><div class="rgc-scan-title">${esc(t)}</div></div>${extraHtml}`;
  }

  // ---------- część 0: pytania dla rodzica, dźwięk, mikrofon ----------
  async function setup() {
    stage.innerHTML = '';
    const f = el('div', 'rgc-form');
    f.innerHTML = `
      <h2>Zanim zaczniemy (dla rodzica)</h2>
      <p>Test trwa około 10 minut i ma jedną przerwę. Nie ma złych odpowiedzi: gra sprawdza, od czego zacząć naukę.
         Dziecko powinno mieć słuchawki lub głośniki. Prosimy nie podpowiadać.</p>
      <label>Wiek dziecka <select name="age"><option value="">—</option>${[6,7,8,9,10,11,12,13,14].map(a => `<option>${a}</option>`).join('')}</select></label>
      <label>Ile lat uczy się angielskiego w szkole <select name="years"><option value="">—</option>${[0,1,2,3,4,5,6,7].map(a => `<option>${a}</option>`).join('')}</select></label>
      <label class="rgc-check"><input type="checkbox" name="tablet" ${context.hasTablet ? 'checked' : ''}> Mamy tablet graficzny lub ekran dotykowy</label>`;
    stage.appendChild(f);
    await waitButton('Zaczynamy ▶');
    check();
    const age = f.querySelector('[name=age]').value, years = f.querySelector('[name=years]').value;
    context.age = age ? +age : null; context.schoolYears = years ? +years : null;
    context.hasTablet = f.querySelector('[name=tablet]').checked;

    aegisScreen();
    await line(content.lines.intro);
    // dźwięk
    for (let tries = 0; tries < 3; tries++) {
      aegisScreen();
      await line(content.lines.audioCheck);
      const r = await askChoice({
        options: [{ key: 'yes', isText: true, label: '✓ Słyszę' }, { key: 'no', isText: true, label: '✕ Nie słyszę' }],
        cls: 'rgc-small'
      });
      if (r.key === 'yes') { context.audioOk = true; break; }
      context.audioOk = false;
      stage.innerHTML = '<div class="rgc-msg">Podgłośnij komputer albo podłącz słuchawki i spróbuj jeszcze raz.</div>';
      sub.textContent = '';
      await waitButton('Spróbuj jeszcze raz 🔊');
    }
    // mikrofon
    aegisScreen('<div class="rgc-mic"><div class="rgc-mic-level"></div>🎤</div>');
    await line(content.lines.micCheck);
    const lvl = stage.querySelector('.rgc-mic-level');
    const r = await mic.listen({ waitMs: 5000, maxMs: 6000, onLevel: v => { if (lvl) lvl.style.transform = `scale(${0.6 + v})`; } });
    check();
    context.micOk = !!r.responded;
    await line(context.micOk ? content.lines.micOk : content.lines.micNo);
  }

  // ---------- części testu ----------
  function optsFrom(list) { return list.map(([key, emoji]) => ({ key, emoji })); }

  async function runLevels(section, makeItem) {
    sectionModes[section.key] = 'levels';
    let done = 0;
    for (const L of ['A', 'B', 'C']) {
      let ok = 0, n = 0;
      const plan = makeItem.plan(L);
      for (const spec of plan) {
        const it = await makeItem.ask(spec, L);
        it.level = L; it.section = section.key; it.skill = section.skill;
        store(it); n++; if (it.correct) ok++;
        progress(section.key, ++done);
        await feedback();
      }
      if (ok < section.passAt) break;
    }
  }

  const sectionRunners = {
    async words(section) {
      await runLevels(section, {
        plan: L => shuffle(content.wordPools[L]).slice(0, section.perLevel),
        async ask([word, emoji], L) {
          const others = shuffle(content.wordPools[L].filter(w => w[0] !== word)).slice(0, 2);
          const options = shuffle(optsFrom([[word, emoji], ...others]));
          const r = await askChoice({ options, prompt: s => speak(word, { slow: s }), subtitle: section.intro.pl });
          return { id: 'w_' + word, mode: 'listen', contrast: null, target: word, shown: options.map(o => o.key), answer: r.key, correct: r.key === word, errorType: r.key === word ? null : 'vocab', rtMs: r.rtMs, replays: r.replays, slowUsed: r.slowUsed };
        }
      });
    },

    async contrasts(section) {
      sectionModes.contrasts = 'list';
      let done = 0, sdIntroDone = false;
      for (const spec of shuffle(content.contrastItems)) {
        let it;
        if (spec.type === 'pair') {
          const target = Math.random() < 0.5 ? spec.a : spec.b;
          const options = shuffle([spec.a, spec.b]).map(([key, emoji]) => ({ key, emoji }));
          const r = await askChoice({
            options, subtitle: section.intro.pl,
            prompt: async (slow, btns) => {
              for (const b of btns) { b.classList.add('rgc-lit'); await speak(b.dataset.key, { slow }); b.classList.remove('rgc-lit'); await sleep(250); }
              await sleep(500);
              wrap.classList.add('rgc-ask'); await speak(target[0], { slow }); wrap.classList.remove('rgc-ask');
            }
          });
          it = { id: spec.id, mode: 'listen', contrast: spec.contrast, target: target[0], shown: options.map(o => o.key), answer: r.key, correct: r.key === target[0], rtMs: r.rtMs, replays: r.replays, slowUsed: r.slowUsed };
        } else {
          if (!sdIntroDone) { sdIntroDone = true; aegisScreen(); await line(section.introSameDiff); }
          const words = Math.random() < 0.5 ? spec.words.slice() : spec.words.slice().reverse();
          const same = words[0] === words[1];
          const options = [{ key: 'same', isText: true, label: '= takie same' }, { key: 'different', isText: true, label: '≠ różne' }];
          const r = await askChoice({
            options, subtitle: section.introSameDiff.pl,
            prompt: async slow => { await speak(words[0], { slow }); await sleep(450); await speak(words[1], { slow }); }
          });
          const correct = (r.key === 'same') === same;
          it = { id: spec.id, mode: 'listen', contrast: spec.contrast, target: same ? 'same' : 'different', words, shown: ['same', 'different'], answer: r.key, correct, rtMs: r.rtMs, replays: r.replays, slowUsed: r.slowUsed };
        }
        it.section = 'contrasts'; it.skill = section.skill; it.level = null;
        it.errorType = it.correct ? null : (it.contrast ? 'contrast_' + it.contrast : 'other');
        store(it); progress('contrasts', ++done);
        await feedback();
      }
    },

    async phonics(section) {
      sectionModes.phonics = 'list';
      let done = 0, wrongInRow = 0;
      for (const spec of content.phonicsItems) {
        const options = shuffle(spec.options).map(([w]) => ({ key: w, isText: true, label: w }));
        const r = await askChoice({ options, prompt: s => speak(spec.word, { slow: s }), subtitle: section.intro.pl, cls: 'rgc-words' });
        const chosen = spec.options.find(o => o[0] === r.key);
        const it = { id: spec.id, section: 'phonics', skill: section.skill, level: null, mode: 'choose', contrast: null, target: spec.word, shown: options.map(o => o.key), answer: r.key, correct: r.key === spec.word, errorType: chosen ? chosen[1] : 'other', rtMs: r.rtMs, replays: r.replays, slowUsed: r.slowUsed };
        wrongInRow = it.correct ? 0 : wrongInRow + 1;
        if (wrongInRow >= section.stopAfterWrongInRow) it.stopRule = true;
        store(it); progress('phonics', ++done);
        await feedback();
        if (it.stopRule) break;
      }
    },

    async reading(section) {
      await runLevels(section, {
        plan: L => content.readingLevels[L],
        async ask(spec) {
          const options = shuffle(optsFrom(spec.options));
          const correctKey = spec.options[0][0];
          const r = await askChoice({ options, text: spec.text, subtitle: section.intro.pl });
          return { id: spec.id, mode: 'read', contrast: null, target: correctKey, shown: options.map(o => o.key), answer: r.key, correct: r.key === correctKey, errorType: r.key === correctKey ? null : 'reading', rtMs: r.rtMs, replays: 0, slowUsed: false };
        }
      });
    },

    async listening(section) {
      await runLevels(section, {
        plan: L => content.listeningLevels[L],
        async ask(spec) {
          const options = shuffle(spec.options.map(([key, emoji]) => /^\d+$/.test(emoji) ? { key, isText: true, label: emoji } : { key, emoji }));
          const correctKey = spec.options[0][0];
          const r = await askChoice({ options, prompt: s => speak(spec.say, { slow: s }), subtitle: section.intro.pl });
          return { id: spec.id, mode: 'listen', contrast: null, target: correctKey, shown: options.map(o => o.key), answer: r.key, correct: r.key === correctKey, errorType: r.key === correctKey ? null : 'comprehension', rtMs: r.rtMs, replays: r.replays, slowUsed: r.slowUsed };
        }
      });
    },

    async spelling(section) {
      await runLevels(section, {
        plan: L => content.spellingLevels[L],
        async ask(spec) {
          sub.textContent = section.intro.pl;
          const r = await askTiles({ word: spec.word, extra: spec.extra, prompt: s => speak(spec.word, { slow: s }) });
          const correct = r.answer === spec.word.replace(/ /g, '');
          return { id: spec.id, mode: 'drag', contrast: null, target: spec.word, shown: null, answer: r.answer, correct, errorType: classifySpelling(spec.word, r.answer), rtMs: r.rtMs, replays: r.replays, slowUsed: r.slowUsed };
        }
      });
    },

    async speaking(section) {
      sectionModes.speaking = 'list';
      let done = 0;
      for (const spec of content.speakingItems) {
        aegisScreen(`<div class="rgc-say">${esc(spec.word)}</div><div class="rgc-mic"><div class="rgc-mic-level"></div>🎤</div>`);
        sub.textContent = section.intro.pl;
        await speak(spec.word);
        const lvl = stage.querySelector('.rgc-mic-level');
        stage.querySelector('.rgc-mic').classList.add('on');
        const r = await mic.listen({ waitMs: 4000, maxMs: 6000, onLevel: v => { if (lvl) lvl.style.transform = `scale(${0.6 + v})`; } });
        check();
        let recKey = null;
        if (r.blob && r.responded) {
          recKey = `${profile.id || 'anon'}/${session}/${spec.id}`;
          await saveClip(recKey, r.blob, { word: spec.word, mission: 'calibration', profileId: profile.id || null });
        }
        store({ id: spec.id, section: 'speaking', skill: section.skill, level: null, mode: 'speak', contrast: null, target: spec.word, shown: null, answer: null, correct: null, errorType: null, rtMs: r.latencyMs, replays: 0, slowUsed: false, responded: r.responded, latencyMs: r.latencyMs, durationMs: r.durationMs, peak: r.peak, recKey });
        progress('speaking', ++done);
        await feedback();
      }
    }
  };

  async function takeBreak() {
    breakTaken = true;
    aegisScreen('<div class="rgc-charge"><div class="rgc-charge-fill"></div></div>');
    await line(content.lines.breakTime);
    await waitButton('Jestem gotowy ▶', { delayMs: 12000 });
    check();
    aegisScreen();
    await line(content.lines.breakEnd);
  }

  async function run() {
    await setup();
    for (const section of content.sections) {
      check();
      if (section.key === 'break') { await takeBreak(); continue; }
      if (section.needsMic && !context.micOk) continue;
      wrap.dataset.section = section.key;
      wrap.querySelector('.rgc-title').textContent = section.title.toUpperCase();
      aegisScreen();
      await line(section.intro);
      await sectionRunners[section.key](section);
    }
    progress(null, 0);
    const result = buildResult({ profileId: profile.id || null, startedAt, finishedAt: new Date().toISOString(), context, items, breakTaken, version: content.version, sectionModes });
    aegisScreen();
    await line(content.lines.end);
    mic.close();
    alive = false;
    try { window.dispatchEvent(new CustomEvent('rg:calibration-complete', { detail: result })); } catch (e) {}
    onComplete(result);
  }

  function cleanup() {
    alive = false; mic.close();
    try { speechSynthesis.cancel(); } catch (e) {}
    document.querySelectorAll('audio').forEach(a => a.pause());
  }

  run().catch(e => { if (!(e instanceof Aborted)) { console.error('Kalibracja', e); stage.innerHTML = `<div class="rgc-msg">Coś poszło nie tak: ${esc(e.message)}</div>`; } });
  return cleanup;
}
