// Odtwarzanie nagranych słówek i zdań: assets/audio/words/{en,en-slow,pl}/<slug>.mp3
// slug() musi być identyczny z tools/nagraj_edge_tts.py
export function slug(t) {
  t = String(t).trim();
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = (Math.imul(h, 33) + t.charCodeAt(i)) >>> 0;
  const s = t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
  return `${s}_${h.toString(16)}`;
}
let current = null;
export function say(text, { slow = false, lang = 'en', base = '' } = {}) {
  if (current) { current.pause(); current = null; }
  const dir = lang === 'pl' ? 'pl' : slow ? 'en-slow' : 'en';
  const a = new Audio(`${base}assets/audio/words/${dir}/${slug(text)}.mp3`);
  current = a;
  return new Promise(res => {
    a.onended = () => res(true);
    a.onerror = () => { // brak nagrania: syntezator przeglądarki jako zapas
      try {
        const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'pl' ? 'pl-PL' : 'en-US'; u.rate = slow ? 0.6 : 0.9;
        u.onend = () => res(false); speechSynthesis.cancel(); speechSynthesis.speak(u);
      } catch (e) { res(false); }
    };
    a.play().catch(() => a.onerror());
  });
}
