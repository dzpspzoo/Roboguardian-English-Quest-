# Asystent AEGIS-7 (`src/assistant/`)

Lokalny analityk postępów: działa w przeglądarce, bez serwera, bez kluczy API. Dane dziecka nie wychodzą z przeglądarki.
Głębsza analiza: rodzic kopiuje raport (`claudePrompt`) i wkleja go we własnym Claude.

| Plik | Co |
|---|---|
| `assistant.js` | moduł ES `RGAssistant` (ustawia też `window.RGAssistant`) |
| `panel.js` | `renderParentPanel(root, profile)` – gotowy widok raportu do panelu rodzica |
| `demo.html` | podgląd na danych symulowanych (`python -m http.server`, potem `/src/assistant/demo.html`) |
| `tests/` | `node --test src/assistant/tests/*.mjs` |

## Wejście: zdarzenia odpowiedzi

`RGAssistant.record(profile, event)` przyjmuje format z `docs/ARCHITEKTURA.md`
`{ t, session, mission, item, skill, mode, ok, ms, opts, hint, chosen, level }`
oraz bez przeróbek:
- format misji rozdziału 1: `{ ts, missionId, itemId, skill:'ear'|'letter'|'spell'|'read'|'phrase', target, correct, attempts, ms, replays, slowUsed, hintShown }`
  (`ear` + `target` → `phoneme.<dźwięk>`; liczy się tylko odpowiedź za 1. razem),
- pozycje testu startowego (`items[]` schematu `roboguardian.calibration/1`), w tym `errorType`.

Surowy `profile.assistant.log` zapisany przez rdzeń, gdy asystent nie był wczytany, jest przeliczany przy pierwszym użyciu.
`profile.calibration` jest importowany automatycznie przy `analyze/report` albo ręcznie przez `importCalibration(profile, result)`.

## Wyjście

- `nextSettings(profile, missionId | {mission, skill, session})` → `{ level, speed, options/opts, polishHint ('always'|'after-wrong'|'never'), plHint, newPerRound, replayAudio, slowAudio, suggestBreak, message, messagePl }`
- `getDifficulty(profile, missionId)` → `{ level 1|2|3, focusItems, skipItems, slowAudioDefault, maxChoices, polishHint, speed, suggestBreak }`
- `pickItems(profile, pool, n, missionId?)` → n elementów puli: kilka nowych (wg poziomu), powtórki najsłabszych, jedno pewne słowo
- `analyze(profile)` → `{ stats, problems[], strengths[], plan[] }`
- `report(profile, {name})` → `{ text }` po polsku; `claudePrompt(profile, {age})` → tekst dla Claude (bez imienia)

## Jak działa

- **Słówka:** pudełka Leitnera 0–5 (powtórki po 10 min, 1, 3, 7, 21 dniach). Błąd cofa do pudełka 0–1. Z polską podpowiedzią maks. pudełko 2.
- **Poziom 1–5 na umiejętność:** dobra odpowiedź +0,04, zła −0,16, więc poziom ustala się tam, gdzie dziecko ma ok. 80% dobrych. Poziom ogólny to średnia ważona umiejętności (na początku z poziomem z testu startowego).
- **Problemy:** słaba umiejętność, systematyczne mylenie par (his/her, ship/sheep), powtarzające się typy błędów, słuchanie vs czytanie, zgadywanie (złe kliknięcia < 1,5 s), zmęczenie w sesji, nadużywanie podpowiedzi, uparte słowa, przerwy w nauce. Każdy problem ma radę dla rodzica i opis, co robi gra.
- **Przerwa:** sesja > 15 min i ostatnie 8 odpowiedzi wyraźnie gorsze → `suggestBreak` i łatwiejsze ustawienia.
