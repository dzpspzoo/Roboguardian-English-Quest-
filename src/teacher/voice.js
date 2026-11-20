// Głosy Nauczyciela. Głos 0 = biblioteka słówek gry (ctx.say), głosy 1–3 = nagrania
// assets/audio/teacher/v1..v3/<slug>.mp3 (tools/nagraj_nauczyciel.py). Gdy nagrania brak,
// syntezator przeglądarki z innym angielskim głosem, żeby dziecko słyszało ten sam zwrot w kilku głosach.
import { slug } from '../core/say.js';

let current = null;
function stop() { if (current) { try { current.pause(); } catch (e) {} current = null; } try { speechSynthesis.cancel(); } catch (e) {} }

function synthVoices() {
  try { return speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang)); } catch (e) { return []; }
}
function synth(text, n, slow) {
  return new Promise(res => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      const vs = synthVoices();
      if (vs.length) u.voice = vs[n % vs.length];
      u.lang = (u.voice && u.voice.lang) || 'en-US';
      u.rate = slow ? 0.6 : 0.9;
      if (vs.length < 2) u.pitch = [1, 1.35, 0.8, 1.15][n % 4]; // jeden głos w systemie: chociaż inna wysokość
      u.onend = () => res(true); u.onerror = () => res(false);
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { res(false); }
  });
}
function file(url) {
  return new Promise(res => {
    const a = new Audio(url); current = a;
    a.onended = () => res(true); a.onerror = () => res(null);
    a.play().catch(() => res(null));
  });
}

export function makeVoice(ctx) {
  const base = (ctx && ctx.base) || '';
  async function play(text, { voice = 0, slow = false } = {}) {
    stop();
    if (voice === 0 || slow) {
      if (ctx && ctx.say) return ctx.say(text, { slow });
      return synth(text, 0, slow);
    }
    const ok = await file(`${base}assets/audio/teacher/v${voice}/${slug(text)}.mp3`);
    if (ok !== null) return ok;
    return synth(text, voice, false);
  }
  // Ten sam zwrot w kilku głosach, z przerwą (trening na wielu głosach).
  async function series(text, voices = [0, 1, 2], alive = () => true) {
    for (const v of voices) { if (!alive()) return; await play(text, { voice: v }); await pause(350); }
  }
  async function aegis(text) {
    stop();
    if (ctx && ctx.aegisSay) return ctx.aegisSay(text);
    return play(text);
  }
  // Polski lektor: syn słabo czyta, więc polecenia, wskazówki i tłumaczenia też słyszy.
  async function pl(text) {
    if (!text) return;
    if (ctx && ctx.say) return ctx.say(text, { lang: 'pl' });
    return new Promise(res => { try { const u = new SpeechSynthesisUtterance(text); u.lang = 'pl-PL'; u.onend = () => res(true); u.onerror = () => res(false); speechSynthesis.speak(u); } catch (e) { res(false); } });
  }
  return { play, series, aegis, pl, stop };
}

export const pause = ms => new Promise(r => setTimeout(r, ms));
