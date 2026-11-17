// Wypisuje wszystkie zdania misji rozdziału 1 do nagrania (zawsze zgodne z danymi misji).
// node tools/frazy_ch1.mjs  ->  tools/frazy-ch1.txt (słówka i zdania, czysty głos)
//                              tools/frazy-aegis-ch1.txt (kwestie AEGIS-7, głos robota)
// Nagrania (na komputerze z kluczem):
//   python tools/nagraj_edge_tts.py tools/frazy-ch1.txt assets/audio/words
//   python tools/robot_voice.py batch tools/frazy-aegis-ch1.txt assets/audio/aegis
import { writeFileSync } from 'node:fs';
import { WORDS, MISSIONS, AEGIS_LINES } from '../src/missions/_shared/ch1-data.js';

const words = new Set(Object.keys(WORDS));
const aegis = new Set();
for (const m of MISSIONS) {
  for (const w of [...m.words, ...(m.build || []), ...(m.pairs || []).flat(), ...(m.letterSlots || []).map(s => s.w)]) words.add(w);
  for (const p of m.phrases || []) words.add(p.en);
  for (const c of m.commands || []) words.add(c.en);
  for (const t of m.talk || []) { aegis.add(t.q.en); for (const a of t.a) words.add(a.en); }
  aegis.add(m.intro.en); aegis.add(m.cheer.en);
}
for (const v of Object.values(AEGIS_LINES)) (Array.isArray(v) ? v : [v]).forEach(l => aegis.add(l.en));
const here = new URL('.', import.meta.url);
writeFileSync(new URL('frazy-ch1.txt', here), [...words].map(w => `en|${w}`).join('\n') + '\n');
writeFileSync(new URL('frazy-aegis-ch1.txt', here), [...aegis].join('\n') + '\n');
console.log(`słówka i zdania: ${words.size}, kwestie AEGIS-7: ${aegis.size}`);
