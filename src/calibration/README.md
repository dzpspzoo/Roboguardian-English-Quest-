# Test startowy (kalibracja)

Około 10 minut, jedna przerwa. Fabularnie AEGIS-7 „skanuje komunikator” gracza, żeby wiedzieć, jak mu pomagać.
Lektor mówi po angielsku, na ekranie są polskie napisy. Test nie pokazuje „dobrze/źle”, nie ma limitu czasu,
a przy każdym pytaniu są przyciski 🔊 „Jeszcze raz” i 🐢 „Wolniej”.

Podgląd poza grą: `python -m http.server` w katalogu repo, potem
`http://localhost:8000/src/calibration/demo.html` (z dźwiękiem) albo `demo.html?cichy=1` (bez dźwięku, szybkie przeklikanie).

## Przebieg

| Część | Co sprawdza | Jak | Pytań |
|---|---|---|---|
| 0. Start | wiek, lata nauki, tablet, dźwięk, mikrofon | pytania dla rodzica, „Słyszysz mnie?”, „Powiedz: Hello!” | — |
| 1. Słowa | rozumienie słów ze słuchu | słowo → 1 z 3 obrazków, poziomy A/B/C | 3–9 |
| 2. Podobne dźwięki | rozróżnianie par (ship/sheep, pan/pen, cart/card, pear/bear, three/tree, wet/vet, heart/art) | najpierw oba słowa przy obrazkach, potem jedno z nich; albo „takie same czy różne” | 15 |
| 3. Dźwięk i litera | czy zapisuje „po polsku” | słowo → 1 z 3 zapisów (sit / syt / set) | do 10 |
| 4. Czytanie | czytanie bez dźwięku | słowo lub zdanie → obrazek, A/B/C | 3–9 |
| Przerwa | — | „bateria się ładuje”, wstań i przeciągnij się | — |
| 5. Wiadomości | rozumienie poleceń i krótkich tekstów | zdanie → obrazek, A/B/C | 3–9 |
| 6. Kod z liter | pisanie ze słuchu | układanie słowa z kafelków (są litery-pułapki, np. y, ł) | 3–9 |
| 7. Mówienie | czy dziecko odpowiada głosem | powtórz za AEGIS-7, gra sama wykrywa głos | 5 |

Poziomy: po 3 pytania na poziom, dalej tylko przy 2 z 3 poprawnych. Część 3 kończy się po 3 błędach z rzędu.
Część 7 pomija się, gdy mikrofon nie działa. Nagrania zostają w przeglądarce (IndexedDB `rg-recordings`),
na razie bez oceny poprawności. Posłużą do strojenia lokalnej oceny wymowy.

## Wejście i wyjście

```js
import { startCalibration, describeForParent } from './src/calibration/calibration.js';
const stop = startCalibration({ root, profile, audioBase: '', record, onComplete: result => { … }, onExit });
```

- `record(event)` dostaje każdą odpowiedź w formacie asystenta (`mission: 'calibration'`, `skill`, `mode`, `ok`, `ms`,
  `chosen`, `level` 1–3, plus `replays`, `slow`, `errorType`).
- `onComplete(result)` dostaje obiekt `roboguardian.calibration/1`; rdzeń zapisuje go w `profile.calibration`.
  Zdarzenie `rg:calibration-complete` na `window` niesie ten sam obiekt.
- `describeForParent(result)` daje krótki opis po polsku do panelu rodzica.

Najważniejsze pola wyniku (pełny przykład: `tests/scoring.test.mjs`):

- `items[]`: każda odpowiedź (`id, section, skill, level, contrast, target, shown, answer, correct, errorType, rtMs, replays, slowUsed`).
- `sections.{words,contrasts,phonics,reading,listening,spelling,speaking}`: `n, correct, score 0–1, level A|B|C|null, stoppedEarly`.
- `contrasts.{ae_e,i_ee,t_d_final,p_b,th_s_f,w_v,h}`: `n, correct, relatedErrors` (błędy z pisowni wskazujące ten dźwięk).
- `errors`: liczba błędów według typu (`polish_phonetic`, `voicing_t_d`, `vowel_ae_e`, `th`, `w_v`, …).
- `attention`: średni czas odpowiedzi, trend, odtworzenia, użycie wolnego tempa, `fatigueFlag`.
- `profile`: `overall` (`preA1`, `A1-`, `A1`, `A1+`, `A2`), mocne i słabe strony, słabe dźwięki.
- `plan`: 3 pierwsze dźwięki do nauki, długość misji (5 lub 7 min), wsparcia (wolny głos, polskie podpowiedzi,
  kafelki zamiast pisania, tryb mówienia). To wstępna propozycja; asystent AI może ją zmienić.

## Nagrania

Test odtwarza frazy przez `say()` z `src/core/say.js`, czyli pliki `assets/audio/words/{en,en-slow}/<slug>.mp3`.
Gdy pliku brak, mówi syntezator przeglądarki. Brakujące nagrania:

```
node tools/frazy-kalibracja.mjs > tools/frazy-kalibracja.txt
python tools/nagraj_edge_tts.py tools/frazy-kalibracja.txt assets/audio/words
```

## Testy

`node src/calibration/tests/scoring.test.mjs`: ocena wyniku, klasyfikacja błędów pisowni, kompletność treści.
