// Rdzeń gry: ekrany, profile, hangar, wpinanie modułów. Zasady: docs/ARCHITEKTURA.md
import * as store from './store.js';
import { say, slug } from './say.js';
import { PARTS, partName } from './parts.js';

const app = document.getElementById('app');
const VERSION = '0.1.0';

/* ---------- moduły opcjonalne (wpinane, gdy inne wątki je dostarczą) ---------- */
const NOOP_AUDIO = { init() {}, music() {}, sfx() {}, setVolume() {}, mute() {}, stop() {} };
let RGAudio = NOOP_AUDIO;
let renderParentPanel = null;
async function optionalImport(path) { try { return await import(path); } catch (e) { return null; } }
const ready = (async () => {
  const a = await optionalImport('../audio/audio.js');
  RGAudio = (a && (a.RGAudio || a.default)) || window.RGAudio || NOOP_AUDIO;
  const s = await optionalImport('../assistant/assistant.js');
  if (s && (s.RGAssistant || s.default) && !window.RGAssistant) window.RGAssistant = s.RGAssistant || s.default;
  const pm = await optionalImport('../assistant/panel.js');
  if (pm && pm.renderParentPanel) renderParentPanel = pm.renderParentPanel;
})();
const sfx = id => { try { RGAudio.sfx(id); } catch (e) {} };
const music = id => { try { RGAudio.music(id); } catch (e) {} };
let audioUnlocked = false;
addEventListener('pointerdown', () => { if (!audioUnlocked) { audioUnlocked = true; try { RGAudio.init(); } catch (e) {} } }, { capture: true });

/* ---------- pomocniki ---------- */
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let cleanup = null;
function show(el) {
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) {} }
  cleanup = null; app.replaceChildren(el); el.querySelector('[autofocus]')?.focus();
  return el;
}
function toast(msg) { const t = h(`<div class="toast">${esc(msg)}</div>`); document.body.append(t); setTimeout(() => t.remove(), 2600); }
function on(el, sel, fn) { el.querySelectorAll(sel).forEach(b => b.addEventListener('click', e => { sfx('click'); fn(e, b); })); }

// AEGIS-7 mówi: najpierw nagranie robota (assets/audio/aegis/<slug>.wav|mp3), potem zwykły głos.
function aegisSay(text) {
  try { RGAudio.duck && RGAudio.duck(true); } catch (e) {}
  return new Promise(res0 => {
    const res = v => { try { RGAudio.duck && RGAudio.duck(false); } catch (e) {} res0(v); };
    const tryFile = (exts) => {
      if (!exts.length) { say(text).then(res); return; }
      const a = new Audio(`assets/audio/aegis/${slug(text)}.${exts[0]}`);
      a.onended = () => res(true); a.onerror = () => tryFile(exts.slice(1));
      a.play().catch(() => tryFile(exts.slice(1)));
    };
    tryFile(['wav', 'mp3']);
  });
}

/* ---------- ekran tytułowy ---------- */
function titleScreen() {
  music('theme_main');
  const profiles = store.listProfiles();
  const el = show(h(`
  <section class="screen">
    <div class="bg" style="background-image:url(assets/gfx/backgrounds/start.svg),url(assets/img/hangar.webp)"></div>
    <div class="wrap center">
      <div style="flex:1;min-height:30vh"></div>
      <h1 class="logo"><img src="assets/gfx/ui/logo.svg" alt="Roboguardian English Quest" onerror="this.replaceWith(Object.assign(document.createElement('span'),{innerHTML:'ROBOGUARDIAN<small>ENGLISH QUEST</small>'}))"></h1>
      <div class="menu">
        ${profiles.length ? `<button class="btn primary big" data-a="continue" autofocus>▶ Graj dalej: ${esc(profiles[0].avatar)} ${esc(profiles[0].name)}</button>` : ''}
        <button class="btn ${profiles.length ? '' : 'primary'} big" data-a="new" ${profiles.length ? '' : 'autofocus'}>✚ Nowa gra</button>
        ${profiles.length > 1 ? `<button class="btn big" data-a="load">📂 Wczytaj grę</button>` : ''}
        <div class="row" style="justify-content:center">
          <button class="btn" data-a="special">🚀 Misje specjalne</button>
          <button class="btn" data-a="settings">⚙ Ustawienia</button>
          <button class="btn" data-a="parent">👨‍👩‍👦 Panel rodzica</button>
        </div>
      </div>
      <p class="footer">Wersja ${VERSION} · darmowa gra · wyniki zostają tylko w tej przeglądarce</p>
    </div>
  </section>`));
  on(el, '[data-a]', (e, b) => {
    const a = b.dataset.a;
    if (a === 'continue') { store.selectProfile(profiles[0].id); routeForProfile(); }
    if (a === 'new') newGameScreen();
    if (a === 'load') loadScreen();
    if (a === 'special') specialScreen();
    if (a === 'settings') settingsScreen();
    if (a === 'parent') parentGate();
  });
}

/* ---------- nowa gra ---------- */
const AVATARS = ['🛡️', '🚀', '🤖', '⚡', '🦊', '🐉', '🦅', '⭐'];
function newGameScreen() {
  let avatar = AVATARS[0];
  const el = show(h(`
  <section class="screen">
    <div class="bg" style="background-image:url(assets/img/hangar.webp)"></div>
    <div class="topbar"><button class="iconbtn" data-a="back" aria-label="Wstecz">←</button><span class="title">Nowa gra</span></div>
    <div class="wrap center">
      <div class="panel col" style="align-items:center;max-width:640px;width:100%">
        <h2>Jak masz na imię, Strażniku?</h2>
        <p class="muted">Imię zostaje tylko na tym urządzeniu. AEGIS-7 będzie się tak do Ciebie zwracał.</p>
        <input type="text" id="name" maxlength="24" placeholder="Twoje imię" autocomplete="off" autofocus>
        <p>Wybierz znak:</p>
        <div class="avatars">${AVATARS.map((a, i) => `<button data-av="${a}" class="${i ? '' : 'on'}" aria-label="znak ${a}">${a}</button>`).join('')}</div>
        <label class="row" style="justify-content:center;font-size:18px"><input type="checkbox" id="tablet" style="width:24px;height:24px"> Mam tablet graficzny lub ekran dotykowy z rysikiem</label>
        <button class="btn primary big" data-a="go">Zaczynamy ▶</button>
      </div>
    </div>
  </section>`));
  el.querySelectorAll('[data-av]').forEach(b => b.onclick = () => { avatar = b.dataset.av; el.querySelectorAll('[data-av]').forEach(x => x.classList.toggle('on', x === b)); sfx('click'); });
  const go = () => {
    const name = el.querySelector('#name').value.trim();
    if (!name) { el.querySelector('#name').focus(); toast('Wpisz imię'); return; }
    const p = store.createProfile(name, avatar);
    p.settings.tablet = el.querySelector('#tablet').checked; store.saveProfile(p);
    sfx('power_up'); routeForProfile();
  };
  el.querySelector('#name').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  on(el, '[data-a]', (e, b) => b.dataset.a === 'back' ? titleScreen() : go());
}

function loadScreen() {
  const ps = store.listProfiles();
  const el = show(h(`
  <section class="screen">
    <div class="bg" style="background-image:url(assets/img/hangar.webp)"></div>
    <div class="topbar"><button class="iconbtn" data-a="back" aria-label="Wstecz">←</button><span class="title">Wczytaj grę</span></div>
    <div class="wrap"><div class="cards">${ps.map(p => `
      <button class="card" data-id="${p.id}"><span class="big">${esc(p.avatar)}</span><h3>${esc(p.name)}</h3>
      <span class="muted">Części robota: ${p.progress.parts.length} / ${PARTS.length}</span>
      <div class="bar"><i style="width:${Math.round(100 * p.progress.parts.length / PARTS.length)}%"></i></div></button>`).join('')}
    </div></div>
  </section>`));
  on(el, '[data-a=back]', titleScreen);
  on(el, '[data-id]', (e, b) => { store.selectProfile(b.dataset.id); routeForProfile(); });
}

/* ---------- kolejność: historia → test → hangar ---------- */
function routeForProfile() {
  const p = store.getProfile(); if (!p) return titleScreen();
  try { RGAudio.setVolume('music', p.settings.musicVol); RGAudio.setVolume('sfx', p.settings.sfxVol); } catch (e) {}
  if (!p.progress.storySeen) return storyScreen();
  if (!p.progress.calibrationDone) return calibrationScreen();
  hangarScreen();
}

async function storyScreen({ replay = false } = {}) {
  const root = show(h(`<section class="screen"></section>`));
  const finish = () => { const p = store.getProfile(); if (p && !p.progress.storySeen) { p.progress.storySeen = true; store.saveProfile(p); } replay ? hangarScreen() : routeForProfile(); };
  const mod = await optionalImport('../story/player.js');
  let data = null; try { data = await (await fetch('src/story/intro.json')).json(); } catch (e) {}
  if (mod && mod.playStory && data) {
    try { const stop = mod.playStory(root, data, { onEnd: finish, onMusic: id => music(id), basePath: '' }); cleanup = typeof stop === 'function' ? stop : null; return; }
    catch (e) { console.error(e); }
  }
  placeholder(root, 'Historia AEGIS-7', 'Film z historią robota i rodziny naukowców jest właśnie nagrywany. Pojawi się tutaj w kolejnej wersji.',
    'Hello, Guardian. I am Aegis Seven.', 'Witaj, Strażniku. Jestem AEGIS-7.', finish);
}

async function calibrationScreen() {
  const root = show(h(`<section class="screen"></section>`));
  const p = store.getProfile();
  const finish = (result) => { const q = store.getProfile(); q.progress.calibrationDone = true; if (result) q.calibration = result; store.saveProfile(q); hangarScreen(); };
  const mod = await optionalImport('../calibration/calibration.js');
  if (mod && mod.startCalibration) {
    try {
      const stop = mod.startCalibration({ root, profile: p, audioBase: 'assets/audio/words/', record: store.record, onComplete: finish });
      cleanup = typeof stop === 'function' ? stop : null; return;
    } catch (e) { console.error(e); }
  }
  placeholder(root, 'Skan komunikatora', 'Tu będzie krótki test (ok. 10 minut), który sprawdzi, jak słyszysz i czytasz angielskie słowa. Na jego podstawie AEGIS-7 ułoży Twoje misje. Test jest w budowie.',
    'You are a real Guardian!', 'Jesteś prawdziwym Strażnikiem!', () => finish(null));
}

function placeholder(root, title, text, en, pl, next) {
  root.replaceChildren(...h(`<div><div class="bg" style="background-image:url(assets/img/hangar.webp)"></div>
    <div class="wrap center" style="min-height:100vh">
      <img class="title-robot" src="assets/img/aegis.webp" alt="">
      <h2>${esc(title)}</h2><p class="subtitle">${esc(pl)}</p><p class="muted" style="max-width:640px">${esc(text)}</p>
      <div class="row" style="justify-content:center"><button class="btn" data-a="again">🔊 Posłuchaj</button><button class="btn primary big" data-a="next" autofocus>Dalej ▶</button></div>
    </div></div>`).children);
  aegisSay(en);
  root.querySelector('[data-a=again]').onclick = () => aegisSay(en);
  root.querySelector('[data-a=next]').onclick = () => { sfx('click'); next(); };
  root.querySelector('[data-a=next]').focus();
}

/* ---------- hangar: robot, części, misje ---------- */
async function loadMissions() {
  try { const list = await (await fetch('src/missions/index.json', { cache: 'no-cache' })).json(); return Array.isArray(list) ? list : []; } catch (e) { return []; }
}
async function hangarScreen() {
  music('mission_calm');
  const p = store.getProfile(); if (!p) return titleScreen();
  const list = await loadMissions();
  const metas = [];
  for (const m of list) {
    const mod = await optionalImport(`../missions/${m.path || m.id + '/mission.js'}`.replace('../missions/src/missions/', '../missions/'));
    if (mod && mod.meta && mod.mount) metas.push({ ...mod.meta, mod });
  }
  const got = new Set(p.progress.parts);
  queueMicrotask(() => mountAssembly(document.querySelector('[data-asm]'), got, lastNewPart));
  const pct = Math.round(100 * got.size / PARTS.length);
  const el = show(h(`
  <section class="screen">
    <div class="bg" style="background-image:url(assets/gfx/backgrounds/hangar.svg),url(assets/img/hangar.webp)"></div>
    <div class="topbar">
      <button class="iconbtn" data-a="home" aria-label="Menu">☰</button>
      <span class="title">${esc(p.avatar)} ${esc(p.name)} · Hangar AEGIS-7</span>
      <button class="iconbtn" data-a="story" aria-label="Obejrzyj historię" title="Obejrzyj historię">🎬</button>
      <button class="iconbtn" data-a="settings" aria-label="Ustawienia">⚙</button>
    </div>
    <div class="wrap">
      <div class="hangar">
        <div class="panel robot-box">
          <div style="position:relative">
            <div class="asm" data-asm role="img" aria-label="AEGIS-7: naprawione ${got.size} z ${PARTS.length} części">
              <img src="assets/img/aegis.webp" alt="">
              <img class="lit" src="assets/img/aegis.webp" alt="" style="clip-path:inset(${100 - pct}% 0 0 0)">
            </div>
          </div>
          <p style="margin-top:8px">Naprawa: <b>${got.size} / ${PARTS.length}</b> części</p>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>
        <div class="col">
          <div class="panel col">
            <h2>Misje</h2>
            ${metas.length ? `<div class="cards">${metas.map(m => {
              const st = p.progress.missions[m.id]; const stars = st ? '★'.repeat(st.bestStars || 0) + '☆'.repeat(3 - (st.bestStars || 0)) : '';
              const lock = (m.requires || []).some(r => !p.progress.missions[r]);
              return `<button class="card${lock ? ' locked' : ''}" data-m="${esc(m.id)}" ${lock ? 'disabled title="Najpierw ukończ poprzednią misję"' : ''}>${lock ? '<span class="tag">🔒 najpierw poprzednia misja</span>' : ''}<h3>${esc(m.title)}</h3><span class="muted">${esc(m.titleEn || '')}</span>
                <span>${m.part ? `<span class="tag">część: ${esc(partName(normPart(m.part)))}</span>` : ''} <span class="tag orange">${m.minutes || 6} min</span></span>
                ${stars ? `<span style="font-size:22px;color:var(--rg-accent)">${stars}</span>` : ''}</button>`; }).join('')}</div>`
              : `<p class="muted">Misje rozdziału 1 są w budowie. W tym czasie możesz zagrać w misję specjalną poniżej.</p>`}
          </div>
          <div class="panel col">
            <h2>Misje specjalne</h2>
            <div class="cards">${specialCards()}</div>
          </div>
          <div class="panel col">
            <h3>Części robota</h3>
            <div class="parts">${PARTS.map(x => `<div class="part ${got.has(x.id) ? 'on' : ''}">${got.has(x.id) ? '✔' : '○'} ${esc(x.pl)}</div>`).join('')}</div>
          </div>
        </div>
      </div>
    </div>
  </section>`));
  on(el, '[data-a=home]', titleScreen);
  on(el, '[data-a=settings]', settingsScreen);
  on(el, '[data-a=story]', () => storyScreen({ replay: true }));
  on(el, '[data-m]', (e, b) => missionScreen(metas.find(m => m.id === b.dataset.m)));
}

const SPECIAL = [{ id: 'paliwo', title: 'Paliwo do silników', en: 'Rocket fuel', desc: 'Unit 2: ubrania, pogoda, miesiące, godziny, this/that, his/her', href: 'missions/paliwo/index.html', icon: '⛽' }];
function specialCards() {
  return SPECIAL.map(s => `<a class="card" href="${s.href}"><span class="big">${s.icon}</span><h3>${esc(s.title)}</h3><span class="muted">${esc(s.en)}</span><span>${esc(s.desc)}</span></a>`).join('');
}
function specialScreen() {
  const el = show(h(`
  <section class="screen">
    <div class="bg" style="background-image:url(assets/img/hangar.webp)"></div>
    <div class="topbar"><button class="iconbtn" data-a="back" aria-label="Wstecz">←</button><span class="title">Misje specjalne</span></div>
    <div class="wrap"><p class="muted">Dodatkowe misje pod materiał ze szkoły, np. przed kartkówką.</p><div class="cards">${specialCards()}</div></div>
  </section>`));
  on(el, '[data-a=back]', titleScreen);
}

/* ---------- misja ---------- */
function missionScreen(m) {
  if (!m) return;
  const root = show(h(`<section class="screen"></section>`));
  let finished = false;
  const ctx = {
    profile: store.getProfile(),
    record: store.record,
    say: (text, opt = {}) => say(text, { slow: opt.slow ?? store.getProfile()?.settings.slowVoice, lang: opt.lang }),
    aegisSay,
    audio: RGAudio,
    assistant: window.RGAssistant || null,
    base: "", // prefiks ścieżek od katalogu gry (index.html); folder misji: missionDir
    missionDir: `src/missions/${m.id}/`,
    done: (res = {}) => { if (finished) return; finished = true; rewardScreen(m, res); },
    exit: () => hangarScreen(),
  };
  try { const stop = m.mod.mount(root, ctx); cleanup = typeof stop === 'function' ? stop : null; }
  catch (e) { console.error(e); toast('Misja nie wczytała się'); hangarScreen(); }
}

const CHEERS = [
  ['My arm works again. Thank you, Guardian!', 'Moje ramię znów działa. Dziękuję, Strażniku!'],
  ['I feel stronger. We are a great team!', 'Czuję się silniejszy. Jesteśmy świetną drużyną!'],
  ['One more part. The family is waiting for us!', 'Jeszcze jedna część. Rodzina na nas czeka!'],
  ['Great job, Guardian!', 'Świetna robota, Strażniku!'],
  ['You are a real Guardian!', 'Jesteś prawdziwym Strażnikiem!'],
];
function rewardScreen(m, res) {
  const p = store.getProfile();
  const stars = Math.max(0, Math.min(3, res.stars ?? 2));
  const st = p.progress.missions[m.id] || { plays: 0, bestStars: 0 };
  st.plays++; st.bestStars = Math.max(st.bestStars || 0, stars); st.last = new Date().toISOString(); p.progress.missions[m.id] = st;
  const ids = Array.isArray(res.parts) && res.parts.length ? res.parts
    : res.partEarned === false ? [] : [typeof res.partEarned === 'string' ? res.partEarned : m.part].filter(Boolean);
  const newParts = [];
  for (const raw of ids) { const id = normPart(raw); if (id && !p.progress.parts.includes(id)) { p.progress.parts.push(id); newParts.push(id); } }
  const newPart = newParts[0] || null; lastNewPart = newPart;
  store.saveProfile(p);
  const sm = res.summary && typeof res.summary === 'object' ? res.summary : null;
  const cheer = sm && sm.cheer && sm.cheer.en ? [sm.cheer.en, sm.cheer.pl || ''] : CHEERS[Math.floor(Math.random() * CHEERS.length)];
  const summaryHtml = !res.summary ? '' : !sm ? esc(res.summary)
    : [sm.good && sm.good.length ? `<p>Dobrze poszło: <b>${sm.good.map(esc).join(', ')}</b></p>` : '',
       sm.hard && sm.hard.length ? `<p>Poćwiczymy jeszcze: <b>${sm.hard.map(esc).join(', ')}</b></p>` : '',
       sm.final ? '<p><b>Rozdział 1 ukończony!</b></p>' : ''].join('');
  music('reward_fanfare'); sfx(newPart ? 'part_attach' : 'star');
  const el = show(h(`
  <section class="screen">
    <div class="bg" style="background-image:url(assets/img/hangar.webp)"></div>
    <div class="wrap center">
      <h2>Misja ukończona!</h2>
      <div class="stars" style="color:var(--rg-accent)">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
      ${newParts.map(n => `<p class="tag" style="font-size:20px">Nowa część: ${esc(partName(n))}</p>`).join('')}
      <img class="title-robot" src="assets/img/aegis.webp" alt="AEGIS-7">
      <p class="subtitle">${esc(cheer[1])}</p>
      ${summaryHtml ? `<div class="panel" style="max-width:700px">${summaryHtml}</div>` : ''}
      <div class="row" style="justify-content:center"><button class="btn" data-a="again">🔊</button><button class="btn primary big" data-a="next" autofocus>Do hangaru ▶</button></div>
    </div>
  </section>`));
  setTimeout(() => aegisSay(cheer[0]), 600);
  on(el, '[data-a=again]', () => aegisSay(cheer[0]));
  on(el, '[data-a=next]', hangarScreen);
}

/* ---------- ustawienia ---------- */
function settingsScreen() {
  const p = store.getProfile();
  const s = p ? p.settings : { musicVol: 0.6, sfxVol: 0.8, slowVoice: false };
  const el = show(h(`
  <section class="screen">
    <div class="bg" style="background-image:url(assets/img/hangar.webp)"></div>
    <div class="topbar"><button class="iconbtn" data-a="back" aria-label="Wstecz">←</button><span class="title">Ustawienia</span></div>
    <div class="wrap"><div class="panel col" style="max-width:640px">
      <label class="row">Muzyka <input class="slider" type="range" min="0" max="1" step="0.05" id="mv" value="${s.musicVol}"></label>
      <label class="row">Efekty <input class="slider" type="range" min="0" max="1" step="0.05" id="sv" value="${s.sfxVol}"></label>
      ${p ? `<label class="row"><input type="checkbox" id="slow" ${s.slowVoice ? 'checked' : ''} style="width:24px;height:24px"> Lektor zawsze wolniej</label>
      <label class="row"><input type="checkbox" id="tab" ${s.tablet ? 'checked' : ''} style="width:24px;height:24px"> Mam tablet graficzny / rysik</label>` : '<p class="muted">Ustawienia lektora pojawią się po wybraniu gracza.</p>'}
      <button class="btn" data-a="test">🔊 Sprawdź głos</button>
    </div></div>
  </section>`));
  const upd = () => {
    const mv = +el.querySelector('#mv').value, sv = +el.querySelector('#sv').value;
    try { RGAudio.setVolume('music', mv); RGAudio.setVolume('sfx', sv); } catch (e) {}
    if (p) { p.settings.musicVol = mv; p.settings.sfxVol = sv; p.settings.slowVoice = el.querySelector('#slow').checked; p.settings.tablet = el.querySelector('#tab').checked; store.saveProfile(p); }
  };
  el.querySelectorAll('input').forEach(i => i.addEventListener('change', upd));
  on(el, '[data-a=test]', () => say('What is it?', { slow: el.querySelector('#slow')?.checked }));
  on(el, '[data-a=back]', () => (p ? hangarScreen() : titleScreen()));
}

/* ---------- panel rodzica ---------- */
function parentGate() {
  const a = 6 + Math.floor(Math.random() * 4), b = 3 + Math.floor(Math.random() * 6);
  const el = show(h(`
  <section class="screen">
    <div class="bg" style="background-image:url(assets/img/hangar.webp)"></div>
    <div class="topbar"><button class="iconbtn" data-a="back" aria-label="Wstecz">←</button><span class="title">Panel rodzica</span></div>
    <div class="wrap center"><div class="panel col" style="align-items:center">
      <h2>Tylko dla dorosłych</h2><p>Ile to jest ${a} × ${b}?</p>
      <input type="text" inputmode="numeric" id="ans" autofocus style="width:160px;text-align:center">
      <button class="btn primary" data-a="ok">Wejdź</button>
    </div></div>
  </section>`));
  const check = () => (+el.querySelector('#ans').value === a * b ? parentScreen() : toast('Spróbuj jeszcze raz'));
  el.querySelector('#ans').addEventListener('keydown', e => e.key === 'Enter' && check());
  on(el, '[data-a=ok]', check); on(el, '[data-a=back]', titleScreen);
}
function parentScreen() {
  const ps = store.listProfiles();
  const A = window.RGAssistant;
  const rows = ps.map(p => {
    const log = (p.assistant && p.assistant.log) || [];
    const ok = log.filter(e => e.ok).length;
    let report = '';
    if (!renderParentPanel && A && A.report) { try { report = A.report(p); } catch (e) { report = ''; } }
    return `<div class="panel col">
      <div class="row"><span style="font-size:32px">${esc(p.avatar)}</span><h3 class="grow">${esc(p.name)}</h3>
        <button class="btn small" data-del="${p.id}">Usuń</button></div>
      <p>Części robota: <b>${p.progress.parts.length}/${PARTS.length}</b> · historia: ${p.progress.storySeen ? 'obejrzana' : 'nie'} · test startowy: ${p.progress.calibrationDone ? 'zrobiony' : 'nie'}</p>
      <p>Odpowiedzi w grze: <b>${log.length}</b>${log.length ? `, poprawnych ${Math.round(100 * ok / log.length)}%` : ''}</p>
      ${renderParentPanel ? `<div data-panel="${p.id}"></div>` : report ? `<pre class="report">${esc(typeof report === 'string' ? report : JSON.stringify(report, null, 2))}</pre>` : '<p class="muted">Szczegółowa analiza asystenta AI pojawi się w kolejnej wersji.</p>'}
    </div>`;
  }).join('');
  const el = show(h(`
  <section class="screen">
    <div class="bg" style="background-image:url(assets/img/hangar.webp)"></div>
    <div class="topbar"><button class="iconbtn" data-a="back" aria-label="Wstecz">←</button><span class="title">Panel rodzica</span></div>
    <div class="wrap">
      ${rows || '<p>Nie ma jeszcze żadnego gracza.</p>'}
      <div class="panel col">
        <h3>Kopia zapasowa</h3>
        <p class="muted">Wyniki są zapisane tylko w tej przeglądarce. Pobierz plik, żeby przenieść je na inny komputer albo pokazać nauczycielowi lub logopedzie. Wyniki misji „Paliwo” są w jej własnym panelu.</p>
        <div class="row"><button class="btn" data-a="export">⬇ Pobierz wyniki</button>
          <label class="btn">⬆ Wczytaj z pliku<input type="file" id="imp" accept="application/json" hidden></label></div>
      </div>
    </div>
  </section>`));
  el.querySelectorAll('[data-panel]').forEach(box => { try { renderParentPanel(box, ps.find(p => p.id === box.dataset.panel)); } catch (e) { console.warn(e); } });
  on(el, '[data-a=back]', titleScreen);
  on(el, '[data-del]', (e, b) => { if (confirm('Usunąć tego gracza i jego wyniki?')) { store.deleteProfile(b.dataset.del); parentScreen(); } });
  on(el, '[data-a=export]', () => {
    const blob = new Blob([store.exportAll()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `roboguardian-wyniki-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  });
  el.querySelector('#imp').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try { store.importAll(await f.text()); toast('Wczytano wyniki'); parentScreen(); } catch (e) { toast(e.message); }
  });
}

/* ---------- start ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
ready.finally(titleScreen);
window.RG = { store, say, aegisSay, version: VERSION, go: { title: titleScreen, hangar: hangarScreen, story: storyScreen, calibration: calibrationScreen, parent: parentScreen } };

// --- Robot składany z części (grafika: assets/gfx/characters/aegis7/assembly.svg) ---
const ASM_IDS = {
  torso: ['part-torso', 'part-core'], head: ['part-head'], pelvis: ['part-pelvis'],
  thigh_l: ['part-thigh-l'], thigh_r: ['part-thigh-r'], shin_l: ['part-shin-l'], shin_r: ['part-shin-r'],
  arm_l: ['part-upperarm-l', 'part-shoulder-l'], forearm_l: ['part-forearm-l'],
  arm_r: ['part-upperarm-r', 'part-shoulder-r'], forearm_r: ['part-forearm-r'],
};
let asmSvgText = null;
let lastNewPart = null;
async function mountAssembly(box, got, fresh) {
  if (!box) return;
  try {
    if (!asmSvgText) { const r = await fetch('assets/gfx/characters/aegis7/assembly.svg'); if (!r.ok) return; asmSvgText = await r.text(); }
    if (!box.isConnected) return;
    box.innerHTML = asmSvgText;
    for (const [part, ids] of Object.entries(ASM_IDS)) for (const id of ids) {
      const n = box.querySelector('#' + id); if (!n) continue;
      n.classList.toggle('rg-missing', !got.has(part));
      if (part === fresh) n.classList.add('rg-new');
    }
    lastNewPart = null;
  } catch { /* zostaje obrazek zapasowy */ }
}

// Misje rozdziału 1 używają nazw części '01_tulow' itd.; rdzeń trzyma id z src/core/parts.js.
const PART_ALIAS = { '01_tulow': 'torso', '02_glowa': 'head', '03_miednica': 'pelvis', '04_udo_L': 'thigh_l', '05_udo_P': 'thigh_r',
  '06_golen_L': 'shin_l', '07_golen_P': 'shin_r', '08_ramie_L': 'arm_l', '09_przedramie_L': 'forearm_l', '10_ramie_P': 'arm_r', '11_przedramie_P': 'forearm_r' };
function normPart(id) { return id ? (PART_ALIAS[id] || id) : null; }
