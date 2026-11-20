// window.RGSpeech: rozpoznawanie mowy w całości na urządzeniu (Whisper tiny.en przez transformers.js, pliki w assets/asr/).
// Głos dziecka nie opuszcza przeglądarki: nagranie trafia tylko do modelu w pamięci i jest od razu porzucane.
// Interfejs: available, langs, ready() -> Promise<bool>, hear(lang, {expect, maxMs}) -> Promise<{alts:[...]}|{err}>
const BASE = new URL('../../assets/asr/', import.meta.url).href;
const MODEL = 'whisper-tiny.en';
let loading = null, asr = null;

const can = typeof window !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  && typeof WebAssembly === 'object' && !!(window.AudioContext || window.webkitAudioContext);

function load() {
  if (loading) return loading;
  loading = (async () => {
    const T = await import(BASE + 'transformers.min.js');
    T.env.allowRemoteModels = false;
    T.env.allowLocalModels = true;
    T.env.localModelPath = BASE;
    T.env.useBrowserCache = true;
    T.env.backends.onnx.wasm.wasmPaths = BASE;
    T.env.backends.onnx.wasm.numThreads = 1; // GitHub Pages nie daje izolacji międzydomenowej, więc bez wątków
    asr = await T.pipeline('automatic-speech-recognition', MODEL, { dtype: 'q8', device: 'wasm' });
    return true;
  })().catch(e => { console.warn('RGSpeech: model się nie wczytał', e); loading = null; return false; });
  return loading;
}

// Nagranie z mikrofonu do Float32Array 16 kHz. Kończy się po ciszy (ok. 0,8 s po mowie) albo po maxMs.
async function capture(maxMs) {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { return { err: e && e.name === 'NotAllowedError' ? 'not-allowed' : 'no-mic' }; }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  try {
    const src = ac.createMediaStreamSource(stream);
    const proc = ac.createScriptProcessor(4096, 1, 1);
    const chunks = []; let spoke = false, quietMs = 0, total = 0, peak = 0;
    const done = new Promise(res => {
      proc.onaudioprocess = e => {
        const d = new Float32Array(e.inputBuffer.getChannelData(0)); chunks.push(d);
        let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
        const rms = Math.sqrt(s / d.length); peak = Math.max(peak, rms);
        const ms = 1000 * d.length / ac.sampleRate; total += ms;
        if (rms > 0.02) { spoke = true; quietMs = 0; } else if (spoke) quietMs += ms;
        if ((spoke && quietMs > 800) || total > maxMs) res();
      };
    });
    src.connect(proc); proc.connect(ac.destination);
    await done;
    proc.disconnect(); src.disconnect();
    if (!spoke) return { err: 'no-speech' };
    const len = chunks.reduce((n, c) => n + c.length, 0), all = new Float32Array(len);
    let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
    return { pcm: await resample(all, ac.sampleRate, 16000) };
  } finally {
    stream.getTracks().forEach(t => t.stop());
    ac.close().catch(() => {});
  }
}

async function resample(data, from, to) {
  if (from === to) return data;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const n = Math.ceil(data.length * to / from);
  const oc = new OAC(1, n, to);
  const buf = oc.createBuffer(1, data.length, from); buf.copyToChannel(data, 0);
  const s = oc.createBufferSource(); s.buffer = buf; s.connect(oc.destination); s.start();
  return (await oc.startRendering()).getChannelData(0);
}

// Whisper czasem dopisuje na ciszy typowe "halucynacje"; takie wyniki traktujemy jak brak mowy.
const JUNK = /^(\s*(\[.*?\]|\(.*?\)|you|thank you\.?|thanks for watching!?|bye\.?)\s*)$/i;

const RGSpeech = {
  available: can,
  langs: ['en'],
  ready() { return can ? load() : Promise.resolve(false); },
  async hear(lang, { maxMs = 4000 } = {}) {
    if (lang !== 'en') return { err: 'unsupported' };
    if (!can) return { err: 'unsupported' };
    if (!(await load())) return { err: 'model' };
    const rec = await capture(maxMs);
    if (rec.err) return rec;
    try {
      const out = await asr(rec.pcm, { language: undefined, return_timestamps: false });
      const text = String(out && out.text || '').trim();
      if (!text || JUNK.test(text)) return { err: 'no-speech' };
      return { alts: [text] };
    } catch (e) { return { err: 'asr' }; }
  },
  // wczytanie modelu w tle, żeby pierwsze ćwiczenie z mową nie czekało
  preload() { if (can && !loading) (window.requestIdleCallback || setTimeout)(() => load(), 1500); },
};

if (typeof window !== 'undefined' && !window.RGSpeech) window.RGSpeech = RGSpeech;
export default RGSpeech;
