// RGAudio – muzyka i efekty dźwiękowe gry Roboguardian English Quest.
// Moduł ES bez zależności. Ustawia też window.RGAudio.
//
//   import { RGAudio } from '../audio/audio.js';
//   RGAudio.init();                       // przy pierwszym kliknięciu / dotknięciu
//   RGAudio.music('theme_main');          // pętla z płynnym przejściem
//   RGAudio.music('reward_fanfare');      // krótki utwór: ścisza pętlę, gra raz, wraca
//   RGAudio.sfx('correct');
//   RGAudio.duck(true) / duck(false);     // ściszenie muzyki na czas lektora
//   RGAudio.setVolume('music', 0.5);  RGAudio.mute(true);
//
// Pętle grają bez przerwy dzięki Web Audio (loopStart/loopEnd z manifestu).

const BASE = new URL('../../assets/audio/', import.meta.url);
const SETTINGS_KEY = 'rg.audio.settings';
const FADE = 1.2;          // s, przejście między utworami
const DUCK_LEVEL = 0.35;   // poziom muzyki, gdy mówi lektor
const STINGER_DUCK = 0.15; // poziom pętli w czasie fanfary

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      music: typeof s.music === 'number' ? s.music : 0.7,
      sfx: typeof s.sfx === 'number' ? s.sfx : 0.8,
      muted: !!s.muted,
    };
  } catch { return { music: 0.7, sfx: 0.8, muted: false }; }
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* prywatne okno */ }
}

const state = {
  ctx: null,
  manifest: null,
  manifestPromise: null,
  buffers: new Map(),     // id -> Promise<AudioBuffer>
  settings: loadSettings(),
  master: null, musicBus: null, sfxBus: null, duckGain: null, stingerBus: null,
  current: null,          // { id, src, gain }
  wanted: null,           // id utworu, który ma grać (także przed init)
  ducked: false,
  stingers: 0,
  unlocked: false,
  musicToken: 0,
};

function manifest() {
  if (!state.manifestPromise) {
    state.manifestPromise = fetch(new URL('manifest.json', BASE))
      .then(r => { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); })
      .then(m => (state.manifest = m))
      .catch(err => { console.warn('[RGAudio]', err); state.manifestPromise = null; return null; });
  }
  return state.manifestPromise;
}

function entry(id) {
  const m = state.manifest;
  return m && (m.music[id] || m.sfx[id]) || null;
}

function buildGraph() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  const ctx = new AC();
  state.ctx = ctx;
  state.master = ctx.createGain();
  state.musicBus = ctx.createGain();
  state.duckGain = ctx.createGain();
  state.sfxBus = ctx.createGain();
  state.stingerBus = ctx.createGain(); // fanfary: głośność muzyki, ale bez ściszania pętli
  state.musicBus.connect(state.duckGain).connect(state.master);
  state.stingerBus.connect(state.master);
  state.sfxBus.connect(state.master);
  state.master.connect(ctx.destination);
  applyVolumes(true);
  document.addEventListener('visibilitychange', () => {
    if (!state.ctx) return;
    if (document.hidden) state.ctx.suspend().catch(() => {});
    else if (state.unlocked) state.ctx.resume().catch(() => {});
  });
  return true;
}

function ramp(param, value, time = 0.15) {
  const now = state.ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + time);
}

function applyVolumes(instant = false) {
  if (!state.ctx) return;
  const s = state.settings;
  const t = instant ? 0.001 : 0.15;
  ramp(state.master.gain, s.muted ? 0 : 1, t);
  ramp(state.musicBus.gain, s.music * s.music, t); // krzywa bardziej „uszna”
  ramp(state.stingerBus.gain, s.music * s.music, t);
  ramp(state.sfxBus.gain, s.sfx * s.sfx, t);
  const duck = state.stingers > 0 ? STINGER_DUCK : (state.ducked ? DUCK_LEVEL : 1);
  ramp(state.duckGain.gain, duck, instant ? 0.001 : 0.35);
}

function load(id) {
  if (state.buffers.has(id)) return state.buffers.get(id);
  const p = manifest().then(async () => {
    const e = entry(id);
    if (!e) throw new Error('nieznany dźwięk: ' + id);
    const res = await fetch(new URL(e.file, BASE));
    if (!res.ok) throw new Error(e.file + ' ' + res.status);
    const data = await res.arrayBuffer();
    return await new Promise((ok, bad) => state.ctx.decodeAudioData(data, ok, bad));
  });
  p.catch(err => { console.warn('[RGAudio]', err); state.buffers.delete(id); });
  state.buffers.set(id, p);
  return p;
}

async function startLoop(id) {
  const token = ++state.musicToken;
  let buf;
  try { buf = await load(id); } catch { return; }
  if (token !== state.musicToken || state.wanted !== id) return;
  const e = entry(id);
  const ctx = state.ctx;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const offset = e.loop ? (e.loopStart || 0) : 0;
  if (e.loop) {
    src.loop = true;
    src.loopStart = e.loopStart || 0;
    src.loopEnd = Math.min(e.loopEnd || buf.duration, buf.duration);
  }
  const gain = ctx.createGain();
  const target = e.volume ?? 1;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(target, now + FADE);
  src.connect(gain).connect(state.musicBus);
  src.start(now, offset);
  fadeOutCurrent();
  state.current = { id, src, gain };
}

function fadeOutCurrent(time = FADE) {
  const cur = state.current;
  if (!cur) return;
  state.current = null;
  const now = state.ctx.currentTime;
  cur.gain.gain.cancelScheduledValues(now);
  cur.gain.gain.setValueAtTime(cur.gain.gain.value, now);
  cur.gain.gain.linearRampToValueAtTime(0.0001, now + time);
  try { cur.src.stop(now + time + 0.05); } catch { /* już zatrzymany */ }
}

async function playStinger(id) {
  let buf;
  try { buf = await load(id); } catch { return; }
  const e = entry(id);
  const ctx = state.ctx;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = e.volume ?? 1;
  src.connect(gain).connect(state.stingerBus);
  state.stingers++;
  applyVolumes();
  src.onended = () => { state.stingers = Math.max(0, state.stingers - 1); applyVolumes(); };
  src.start();
}

export const RGAudio = {
  /** Wołaj przy pierwszym kliknięciu/dotknięciu (wymóg przeglądarek). */
  init() {
    if (!state.ctx && !buildGraph()) return Promise.resolve(false);
    state.unlocked = true;
    const p = state.ctx.resume().catch(() => {});
    manifest();
    if (state.wanted && (!state.current || state.current.id !== state.wanted)) startLoop(state.wanted);
    return p.then(() => true);
  },

  /** Lista dostępnych id: { music: [...], sfx: [...] } (po wczytaniu manifestu). */
  async list() {
    const m = await manifest();
    return m ? { music: Object.keys(m.music), sfx: Object.keys(m.sfx) } : { music: [], sfx: [] };
  },

  /** Wczytaj z wyprzedzeniem (np. ekran ładowania sceny). */
  preload(ids) {
    if (!state.ctx) return Promise.resolve();
    return Promise.all([].concat(ids).map(id => load(id).catch(() => null)));
  },

  /** Muzyka: pętle z płynnym przejściem; krótkie utwory (fanfary) grają raz nad pętlą. */
  async music(id) {
    if (!id) return this.stopMusic();
    await manifest();
    const e = entry(id);
    if (!e) { console.warn('[RGAudio] brak utworu', id); return; }
    if (!e.loop) {
      if (state.ctx && state.unlocked) return playStinger(id);
      return;
    }
    if (state.wanted === id && state.current && state.current.id === id) return;
    state.wanted = id;
    if (state.ctx && state.unlocked) return startLoop(id);
  },

  /** Zatrzymaj muzykę (z wyciszeniem). */
  stopMusic(fade = FADE) {
    state.wanted = null;
    state.musicToken++;
    if (state.ctx) fadeOutCurrent(fade);
  },

  /** Aktualnie grająca pętla (id) albo null. */
  get current() { return state.wanted; },

  /** Efekt dźwiękowy. opts: { volume, rate } */
  async sfx(id, opts = {}) {
    if (!state.ctx || !state.unlocked || state.settings.muted) return null;
    let buf;
    try { buf = await load(id); } catch { return null; }
    const e = entry(id);
    const src = state.ctx.createBufferSource();
    src.buffer = buf;
    if (opts.rate) src.playbackRate.value = opts.rate;
    if (opts.loop) src.loop = true;
    const g = state.ctx.createGain();
    g.gain.value = (e.volume ?? 1) * (opts.volume ?? 1);
    src.connect(g).connect(state.sfxBus);
    src.start();
    return { stop: () => { try { src.stop(); } catch { /* */ } } };
  },

  /** Ściszenie muzyki, gdy mówi lektor / AEGIS-7. */
  duck(on = true) { state.ducked = !!on; applyVolumes(); },

  /** Głośność 0..1 dla 'music' albo 'sfx'. */
  setVolume(kind, v) {
    if (kind !== 'music' && kind !== 'sfx') return;
    state.settings[kind] = Math.max(0, Math.min(1, Number(v) || 0));
    saveSettings(state.settings);
    applyVolumes();
  },
  getVolume(kind) { return state.settings[kind]; },

  mute(on = true) { state.settings.muted = !!on; saveSettings(state.settings); applyVolumes(); },
  isMuted() { return state.settings.muted; },
  toggleMute() { this.mute(!state.settings.muted); return state.settings.muted; },
};

if (typeof window !== 'undefined') window.RGAudio = RGAudio;
export default RGAudio;
