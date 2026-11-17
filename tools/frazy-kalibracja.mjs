// Wypisuje frazy testu startowego w formacie dla tools/nagraj_edge_tts.py:
//   node tools/frazy-kalibracja.mjs > tools/frazy-kalibracja.txt
//   python tools/nagraj_edge_tts.py tools/frazy-kalibracja.txt assets/audio/words
import { allPhrases } from '../src/calibration/content.js';
for (const p of allPhrases()) console.log('en|' + p);
