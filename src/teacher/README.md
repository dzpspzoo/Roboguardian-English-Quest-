# Nauczyciel AEGIS-7 (`src/teacher/`)

Codzienna „Misja dnia” (ok. 14 min), która uczy, a nie tylko sprawdza, plus rytm dni: po każdej misji rozdziału
następna otwiera się po 12 h (albo następnego ranka), rodzic może otworzyć wcześniej PIN-em. Na koniec misji żart
AEGIS-a i „See you tomorrow, Guardian!”. Plan i badania: dokument projektu „AEGIS-7: model idealnego nauczyciela angielskiego”.

| Plik | Co |
|---|---|
| `teacher.js` | wejścia dla rdzenia: `todayMission`, `renderTodayCard`, `gate`, `lockScreen`, `farewell`, `renderParentControls` |
| `schedule.js` | czysta logika: blokada, zegar bez cofania, PIN, powtórki rozłożone w czasie (pudełka 0–5: 0, 1, 2, 4, 7, 14 dni), drabina słyszę → rozpoznaję → mówię → piszę, plan dnia, zmęczenie |
| `curriculum.js` | treść: zwroty, pary dźwięków, rozdział 1 (14 dni: 10 dni nauki, 2 powtórki, 2 dni rozmowy), zarys rozdziałów 2–6 |
| `lesson.js` | lekcja w 8 krokach: przypomnienie, zadanie AEGIS-a, pokaz (kilka głosów), para dźwięków, powiedz i nagraj, scenka, napisz, koniec |
| `voice.js` | głosy: biblioteka słówek gry, nagrania `assets/audio/teacher/v1..v3/`, a bez nagrań syntezator z różnymi głosami; polski lektor |
| `jokes.js` | 20 żartów startowych; gra najpierw czyta `src/story/jokes.json` z wątku historii |
| `tests/` | `node --test src/teacher/tests/*.mjs` |

## Zasady (z badań)

- Maks. 3 nowe zwroty dziennie, reszta to powtórki z pamięci w rosnących odstępach; pudełko rośnie najwyżej raz dziennie.
- Dźwięki tylko w prawdziwych słowach, w kilku głosach; po błędzie jawna wskazówka po polsku (czytana lektorem) i ponowne słuchanie.
- Po 2 błędach podświetlenie dobrej odpowiedzi; bez kar i presji czasu. 3 szybkie błędy albo 12 min = misja skraca się do scenki i pisania.
- Po przerwie > 3 dni najpierw powtórka bez nowego materiału.
- Polski lektor (syn słabo czyta): ustawienie w panelu rodzica, domyślnie czyta polecenia, tłumaczenia i podpowiedzi.
- Nagroda: część AEGIS-a co 5 Misji dnia (`PART_EVERY`), w kolejności `PART_ORDER` (od głowy).

## Stan w profilu

Tylko `profile.teacher`: `{ day, items: { id: { box, stage, due, introduced, ok, wrong } }, lastDoneAt, maxSeen, unlockedAfter, unlocks[], rhythm, pinHash, plVoice, energy, history[], jokesSeen[] }`.
Blokada liczy się też od `profile.progress.missions[id].last` (misje rozdziału zapisane przez rdzeń); misje `sp-*` jej nie dotyczą.

## Nagrania

`tools/frazy-nauczyciel.txt` (lista z `phrases()` w `curriculum.js`). Głos 0: `python tools/nagraj_edge_tts.py tools/frazy-nauczyciel.txt assets/audio/words`.
Głosy 1–3: `python tools/nagraj_nauczyciel.py`. Bez nagrań gra mówi syntezatorem przeglądarki.
