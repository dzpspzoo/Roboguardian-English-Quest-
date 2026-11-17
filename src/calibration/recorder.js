// Mikrofon w teście startowym: wykrywa, czy dziecko coś powiedziało (bez rozpoznawania mowy),
// i zapisuje nagranie lokalnie w IndexedDB "rg-recordings". Nic nie jest wysyłane.

const DB = 'rg-recordings', STORE = 'clips';

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function saveClip(key, blob, meta) {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ blob, meta, savedAt: new Date().toISOString() }, key);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
    return true;
  } catch (e) { console.warn('Nagranie nie zapisane', e); return false; }
}

export class Mic {
  constructor() { this.stream = null; this.ctx = null; this.analyser = null; this.denied = false; }

  async open() {
    if (this.stream) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);
      return true;
    } catch (e) { this.denied = true; return false; }
  }

  level() {
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let s = 0; for (const v of buf) s += v * v;
    return Math.sqrt(s / buf.length);
  }

  // Słucha do maxMs. Kończy po `silenceMs` ciszy, gdy już była mowa.
  // Zwraca { responded, latencyMs, durationMs, peak, blob }.
  async listen({ maxMs = 5000, waitMs = 4000, silenceMs = 900, threshold = 0.035, onLevel } = {}) {
    if (!(await this.open())) return { responded: false, latencyMs: null, durationMs: 0, peak: 0, blob: null, denied: true };
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (e) {} }
    // próg dopasowany do szumu w pokoju
    let noise = 0; for (let i = 0; i < 5; i++) { noise = Math.max(noise, this.level()); await sleep(40); }
    const th = Math.max(threshold, noise * 2.5);

    let rec = null; const chunks = [];
    try {
      rec = new MediaRecorder(this.stream);
      rec.ondataavailable = e => e.data && e.data.size && chunks.push(e.data);
      rec.start();
    } catch (e) { rec = null; }

    const t0 = performance.now();
    let start = null, lastVoice = null, peak = 0;
    await new Promise(resolve => {
      const tick = () => {
        const now = performance.now(), lv = this.level();
        peak = Math.max(peak, lv);
        if (onLevel) onLevel(Math.min(1, lv / (th * 3)));
        if (lv > th) { if (start === null) start = now; lastVoice = now; }
        const elapsed = now - t0;
        const done = (start === null && elapsed > waitMs) || (start !== null && now - lastVoice > silenceMs) || elapsed > maxMs;
        if (done) resolve(); else requestAnimationFrame(tick);
      };
      tick();
    });

    let blob = null;
    if (rec) {
      blob = await new Promise(res => { rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); try { rec.stop(); } catch (e) { res(null); } });
    }
    const responded = start !== null && lastVoice - start > 120;
    return {
      responded,
      latencyMs: start === null ? null : Math.round(start - t0),
      durationMs: start === null ? 0 : Math.round(lastVoice - start),
      peak: Math.round(peak * 1000) / 1000,
      blob
    };
  }

  close() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx) { try { this.ctx.close(); } catch (e) {} }
    this.stream = null; this.ctx = null;
  }
}

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
