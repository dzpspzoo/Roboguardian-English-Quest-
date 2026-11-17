# Roboguardian English Quest – wspólne zasady (v1, 17.11.2026)

Gra to statyczna strona (HTML + CSS + JS, **moduły ES**, bez kroku budowania, bez frameworków).
Hosting: GitHub Pages pod podścieżką (`https://dzpspzoo.github.io/roboguardian-english-quest-/`),
więc **wszystkie ścieżki względne, bez `/` na początku**. Lokalnie: `python -m http.server` w katalogu repo
(moduły ES nie działają z `file://`).

## Katalogi i właściciele

| Ścieżka | Kto | Co |
|---|---|---|
| `index.html`, `sw.js`, `manifest.webmanifest`, `src/core/` | wątek szkieletu | ekran startowy, profile, zapis, nawigacja, panel rodzica, scalanie |
| `missions/paliwo/` | wątek szkieletu | misja specjalna „Paliwo” (samodzielna strona, bez zmian) |
| `src/story/`, `src/story/intro.json`, `assets/story/img/`, `assets/audio/story/` | historia | sceny, odtwarzacz historii |
| `assets/gfx/` | grafika | `theme.css`, `characters/`, `backgrounds/`, `ui/icons/`, `manifest.json` |
| `src/audio/`, `assets/audio/music/`, `assets/audio/sfx/`, `assets/audio/manifest.json` | muzyka | `RGAudio`, muzyka, efekty |
| `src/calibration/` | test startowy | kalibracja |
| `src/missions/<id>/` | misje rozdziału 1 | jedna misja = jeden folder |
| `assets/audio/words/{en,en-slow,pl}/<slug>.mp3` | misje + test | nagrania słówek i zdań (wspólna biblioteka) |
| `src/assistant/` | asystent AI | `RGAssistant`: analiza wyników, dobór trudności, raport |
| `tools/` | wszyscy | skrypty do nagrań i grafiki (Python), nigdy kluczy |

Nie edytuj plików innego wątku. Potrzebujesz zmiany w `src/core/` lub `index.html`? Napisz do wątku szkieletu.

## Rdzeń: `src/core/store.js` (profil i zapis)

```js
import { getProfile, saveProfile, record, onProfileChange } from '../core/store.js';
```
- localStorage, jeden klucz `rg.v1`: `{ v:1, activeId, profiles: { [id]: Profile } }`.
- `Profile = { id, name, avatar, createdAt, settings:{ musicVol, sfxVol, slowVoice, tablet }, progress:{ storySeen, calibrationDone, chapter:1, parts:[ids], missions:{ [missionId]:{ plays, bestStars, last } } }, calibration:{…wynik testu…}, assistant:{…tylko asystent…} }`.
- Każdy moduł ma **swój jeden klucz w profilu** i nie rusza innych: historia nic, test → `profile.calibration`, asystent → `profile.assistant`, misje → `profile.progress.missions[id]` (przez `ctx.done`).
- Własne klucze localStorage tylko z prefiksem `rg.<moduł>.` i tylko na ustawienia modułu, nie na wyniki dziecka.
- Nagrania głosu: IndexedDB `rg-recordings` (tylko lokalnie, nigdy wysyłane).

## Zdarzenia odpowiedzi (format asystenta)

Każda odpowiedź dziecka: `ctx.record(event)` (rdzeń przekazuje do `RGAssistant.record(profile, event)` i zapisuje profil).
```js
{ t: Date.now(), session, mission: 'paliwo', item: 'jacket', skill: 'vocab|listening|phoneme.ae|grammar.is_are|time|spelling|reading|speaking',
  mode: 'listen|read|choose|type|drag|speak|write', ok: true, ms: 2300, opts: 3, hint: false, chosen: null, level: 1 }
```
Przed zadaniem: `RGAssistant.nextSettings(profile, missionId)` → `{ speed, opts, plHint, … }`, `RGAssistant.pickItems(profile, pool, n)`.
Panel rodzica: `RGAssistant.report(profile)` → tekst po polsku.
Asystent eksportuje z `src/assistant/assistant.js` i dodatkowo ustawia `window.RGAssistant`.

## Wejścia modułów (rdzeń je woła)

- **Historia**: `src/story/player.js` → `export function playStory(rootEl, data, { onEnd, onMusic, basePath })`, dane `src/story/intro.json`. `onMusic(id)` dostaje **id utworu z listy muzyki** (niżej), nie nastrój.
- **Test startowy**: `src/calibration/calibration.js` → `export function startCalibration({ root, profile, audioBase, record, onComplete })`. Wynik (schemat `roboguardian.calibration/1`) oddaj w `onComplete(result)`; rdzeń zapisze go w `profile.calibration`. Zdarzenie `rg:calibration-complete` może zostać.
- **Misja**: `src/missions/<id>/mission.js` →
  ```js
  export const meta = { id, title, titleEn, chapter: 1, part: 'arm_left', skills: ['phoneme.ae'], minutes: 6 };
  export function mount(root, ctx) { … return () => {/* sprzątanie */}; }
  // ctx = { profile, record, done({ stars, partEarned, summary }), say(text,{slow}), audio: RGAudio, assistant: RGAssistant, base: "" = katalog gry, missionDir: "src/missions/<id>/" }
  ```
  Rejestracja: dopisz misję w `src/missions/index.json` (`[{ id, path }]`). Rdzeń pokazuje montaż części i podsumowanie AEGIS-7 po `done`.
- **Audio**: `src/audio/audio.js` eksportuje `RGAudio` i ustawia `window.RGAudio`. `RGAudio.init()` woła rdzeń przy pierwszym kliknięciu.
  Id muzyki: `theme_main, story_creation, story_family, story_attack, story_crash, story_hangar, mission_calm, mission_action, reward_fanfare, level_complete, try_again`.
  Id efektów: `click, correct, wrong, star, part_attach, power_up, robot_beep, whoosh, unlock, level_up, typing`.
- **Grafika**: `assets/gfx/theme.css` ładuje `index.html` PO `src/core/app.css`, więc jego zmienne `--rg-*` wygrywają. Kolory i fonty tylko przez zmienne CSS z tego pliku.

## Głos i słówka

- Zasada całej gry: **lektor mówi po angielsku, na ekranie polski napis**. Tekst angielski widoczny tylko tam, gdzie dziecko ma czytać.
- Narrator: ElevenLabs „Brian”. AEGIS-7: głos „robot 2” (filtr z `tools/robot_voice.py`). Słówka i zdania: czysty głos (obecnie edge-tts Christopher, normalnie i wolno).
- Nagrania słówek: `assets/audio/words/en/<slug>.mp3`, `en-slow/`, `pl/`. `slug(tekst)` jak w `tools/nagraj_edge_tts.py` (ta sama funkcja w `src/core/say.js`).
- Klucz ElevenLabs tylko w lokalnym pliku poza repo. **Nigdy nie commituj kluczy.**

## Formaty i rozmiary

- Obrazy: `.webp` (lub `.svg`), tło 1920×1080, plik ≤ 400 KB. Audio: `.mp3`, muzyka 128 kb/s stereo, mowa 64–96 kb/s mono.
- Działanie offline: `sw.js` zapisuje pliki w pamięci przy pierwszym użyciu, nie trzeba prowadzić list.
- Ekran: od 1024×600 (tablet) wzwyż, dotyk + mysz + klawiatura, przyciski ≥ 48 px, bez presji czasu, bez kar.

## Repozytorium publiczne

- Żadnych imion, wyników ani nagrań dzieci w repo. Dane dzieci są tylko w ich przeglądarce.
- Kod tylko własny lub na wolnej licencji (podaj źródło w `CREDITS.md`).

## Git

- Każdy wątek ma swoją gałąź, **założoną od `claude/project-thread-y52imp`** (gałąź szkieletu), i zmienia tylko swoje katalogi.
- Gotowe do scalenia? Napisz do wątku szkieletu nazwę gałęzi. Scalanie robi wątek szkieletu.
