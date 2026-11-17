# Misje rozdziału 1: Odbudowa AEGIS-7

8 misji po ok. 5–8 minut. Każda naprawia część robota (części figurki AEGIS-7 v2 z wątku modeli 3D) i ćwiczy jeden trudny dla Polaka dźwięk.

| Nr | Misja | Dźwięk / umiejętność | Nagroda (część) |
|---|---|---|---|
| 1 | Serce robota | /æ/ jak w cat (cat/cut, pan/pen, man/men) | 01_tulow |
| 2 | Oczy i uszy | /ɪ/ jak w ship (ship/sheep, sit/seat) | 02_glowa |
| 3 | Biodra i równowaga | a, e czy i? (pan/pen/pin, bag/big) | 03_miednica |
| 4 | Mocne uda | końcówka t czy d (at/add, sat/sad) | 04_udo_L, 05_udo_P |
| 5 | Pierwsze kroki | pierwszy dźwięk (pit/sit, pin/tin, Sam/am) | 06_golen_L, 07_golen_P |
| 6 | Lewa ręka: tarcza | powtórka wszystkich dźwięków | 08_ramie_L, 09_przedramie_L |
| 7 | Prawa ręka: polecenia | polecenia dla robota (Sit down, Pick up the bag) | 10_ramie_P, 11_przedramie_P |
| 8 | Uruchomienie | pierwsza rozmowa z AEGIS-7 + powtórka | cały robot wstaje |

Dźwięki wybrane z błędów Michała w wersji 1.6: myli am/Sam i pit/sit, pisze „syt”, „ad”, „sad”, „cen”.

## Mini-gry

`listen` osłuchanie (obrazek + polskie znaczenie, wolno i normalnie, bez oceny) ·
`ear` rozróżnianie par · `letter` brakująca litera · `catch` łapanie części chwytakiem (strzałki, dotyk, mysz) ·
`build` składanie słowa z liter (też z klawiatury) · `read` czytanie bez dźwięku · `phrase` zdanie → polskie znaczenie (poziom 3: układanie zdania) ·
`command` polecenia (misja 7) · `talk` odpowiedź na pytanie AEGIS-7 (misja 8) · `echo` „powiedz to robotowi”: nagranie i odsłuch, bez oceny, zapis tylko w IndexedDB `rg-recordings`.

Bez kar i bez limitu czasu. Po 1. błędzie: „Hmm, not this one. Listen again.”, wolne nagranie i polska wskazówka (np. „sit, nie syt”). Po 2. błędzie dobra odpowiedź świeci. Źle rozwiązany element wraca raz na końcu tej samej mini-gry.

## Poziomy trudności

| | Poziom 1 | Poziom 2 | Poziom 3 |
|---|---|---|---|
| opcji do wyboru | 2 | 3 | 4 |
| spadanie części | 11 s | 8,5 s | 6,5 s |
| pierwsze odtworzenie | wolno | normalnie | normalnie |
| polskie podpowiedzi | tak | tak | tylko po błędzie |
| składanie słowa | 1. litera wpisana, bez zbędnych liter | 2 mylące litery (y/i, d/t, e/a) | 4 mylące litery, zdania z wyrazów |
| ikony na częściach | tak | nie | nie |

Poziom startowy: `RGAssistant.getDifficulty(profile, missionId)` (lub `nextSettings`), a bez asystenta poziom z ostatniej gry, potem z testu startowego, w końcu 1.
W trakcie misji: 2 błędy z rzędu → łatwiej („Let's slow down a little.”), 5 dobrych z rzędu → trudniej.
Kolejność i dobór słów: `RGAssistant.pickItems(profile, pool, n, missionId)`. Misje 2–5 dokładają 2 pary z poprzednich misji, 6 i 8 powtarzają wszystkie.

## Integracja (docs/ARCHITEKTURA.md)

- `src/missions/ch1-mN/mission.js`: `meta` + `mount(root, ctx)`; rejestr w `src/missions/index.json`.
- `ctx.record(event)`: jedno zdarzenie na element, `ok` = dobrze za 1. razem; dodatkowo `game`, `sound`, `attempts`, `chosen` (pierwsza zła odpowiedź).
- `ctx.done({ stars, partEarned, parts, summary })`: `summary.cheer` to zdanie otuchy AEGIS-7 po montażu (`{en, pl}`), `summary.hard` / `good` to słowa do podsumowania, `summary.final` = koniec rozdziału.
- Kwestie AEGIS-7: `assets/audio/aegis/<slug>.wav`, słówka i zdania: `assets/audio/words/{en,en-slow}/<slug>.mp3`. Brak pliku → syntezator przeglądarki.
- Style: `ch1.css`, kolory przez zmienne `--rg-*` z `assets/gfx/theme.css` (z zapasem).

## Podgląd i nagrania

- Podgląd bez profilu: `python -m http.server 8000`, potem http://localhost:8000/src/missions/_shared/podglad.html
- Listy do nagrania: `node tools/frazy_ch1.mjs` → `tools/frazy-ch1.txt` (77 słów i zdań) i `tools/frazy-aegis-ch1.txt` (34 kwestie AEGIS-7, ok. 1300 znaków ElevenLabs).
- Treść misji (słowa, pary, zdania, kwestie): `ch1-data.js`.
