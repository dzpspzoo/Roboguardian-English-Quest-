# Misje rozdziału 1: Odbudowa AEGIS-7

8 misji po ok. 10 minut. Kolejność części jak chce rodzic: najpierw głowa, potem tułów z rdzeniem, potem kończyny. Każda naprawia część robota (części figurki AEGIS-7 v2 z wątku modeli 3D) i ćwiczy jeden trudny dla Polaka dźwięk.

| Nr | Misja | Dźwięk / umiejętność | Nagroda (część) |
|---|---|---|---|
| 1 | Oczy i uszy | /ɪ/ jak w ship (ship/sheep, sit/seat) | 02_glowa |
| 2 | Serce robota | /æ/ jak w cat (cat/cut, pan/pen, man/men) | 01_tulow |
| 3 | Biodra i równowaga | a, e czy i? (pan/pen/pin, bag/big) | 03_miednica |
| 4 | Mocne uda | końcówka t czy d (at/add, sat/sad) | 04_udo_L, 05_udo_P |
| 5 | Pierwsze kroki | pierwszy dźwięk (pit/sit, pin/tin, Sam/am) | 06_golen_L, 07_golen_P |
| 6 | Lewa ręka: tarcza | powtórka wszystkich dźwięków | 08_ramie_L, 09_przedramie_L |
| 7 | Prawa ręka: polecenia | polecenia dla robota (Sit down, Pick up the bag) | 10_ramie_P, 11_przedramie_P |
| 8 | Uruchomienie | pierwsza rozmowa z AEGIS-7 + powtórka | cały robot wstaje |

Dźwięki wybrane z błędów Michała w wersji 1.6: myli am/Sam i pit/sit, pisze „syt”, „ad”, „sad”, „cen”.

## Mini-gry

`listen` osłuchanie (obrazek, słowo i polskie znaczenie, wolno i normalnie) ·
`ear` rozróżnianie par · `letter` brakująca litera · `catch` łapanie części chwytakiem (strzałki, dotyk, mysz) ·
`build` składanie słowa z liter (też z klawiatury) · `read` czytanie bez dźwięku · `phrase` zdanie → polskie znaczenie (poziom 3: układanie zdania) ·
`command` polecenia (misja 7, też ruchowe: Jump!, Turn around.) · `talk` odpowiedź na pytanie AEGIS-7 (misja 8) ·
`memory` pary słowo ↔ obrazek · `sort` skrzynie według dźwięku (`M.sort.groups/labels`) ·
`translate` „Powiedz po polsku”: słowo słychać albo widać, dziecko mówi lub wpisuje polskie znaczenie (przyjmuje `WORDS[w].pl` i `alt`, literówka o 1 znak) ·
`teach` „Nowy zwrot”: zdanie słowo po słowie z tłumaczeniem (`M.teach[].gloss`) i wskazówką (`note`), dziecko je mówi, potem wybiera je po polsku → angielsku ·
`say` (dawniej `echo`) „Powiedz to robotowi”: gra słucha i ocenia, do 3 prób („Usłyszałem: pan (patelnia). Powiedz: pen”).

Ocena mowy wyłącznie lokalnie: `window.RGSpeech` z wątku gry (`available`, `langs`, `ready()`, `hear(lang, {expect, maxMs}) → {alts}|{err}`).
Głos dziecka nie wychodzi z urządzenia; bez `RGSpeech` (lub dla języka, którego nie zna) zostaje nagraj i odsłuchaj, a „Powiedz po polsku” ma wpisywanie.

Bez kar i bez limitu czasu. Zła odpowiedź kończy próbę: dobra odpowiedź świeci na zielono, gra odtwarza obie wersje i tłumaczy po polsku różnicę,
słowo wraca raz na końcu tej samej mini-gry. Między minigrami AEGIS-7 mówi losowe, zabawne kwestie (pule w `AEGIS_LINES`, bez powtórek).
Kwestie bez nagrania pokazują tylko napis (bez syntezatora). Brakujące nagrania: `node tools/frazy_ch1.mjs` → `tools/frazy-brakujace-ch1.txt`.

## Język: angielski, polski dopiero po błędzie

Polecenia, przyciski, odprawa i dymek AEGIS-7 są po angielsku. Polskie tłumaczenia (`.ch1-plh`: etykiety, znaczenia słów, wskazówki)
pojawiają się dopiero po złej odpowiedzi (klasa `pl-on` na `.ch1-stage`, zdejmowana przy następnym zadaniu). Nie ma przełącznika „po polsku od początku”.
Treść zadań tłumaczeniowych (zwroty, „Powiedz po polsku”) z natury zawiera polski.

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
- Listy do nagrania: `node tools/frazy_ch1.mjs` → `tools/frazy-ch1.txt` (126 słów i zdań, także działy misji specjalnych) i `tools/frazy-aegis-ch1.txt` (44 kwestie AEGIS-7).
- Treść misji (słowa, pary, zdania, kwestie): `ch1-data.js`.

## Misje specjalne (`meta.special = true`)

| Id | Misja | Przebieg |
|---|---|---|
| `sp-quiz` | Przygotuj się do kartkówki | wybór działu albo własne słówka (`jacket = kurtka`, jedno w linii) → film `quiz` → ok. 10 min treningu (posłuchaj → słyszę → czytam / polski→angielski → układam → piszę) → sprawdzian: polskie słowo, wpisz po angielsku, jedna próba, maks. 10 słów |
| `sp-dictation` | Dyktando | wybór działu, własnych albo najtrudniejszych słów → 10 słów: robot mówi, dziecko wpisuje; złe litery na czerwono, „_” = brak litery, przekreślona = zbędna; po 2. błędzie wzór do przepisania |
| `sp-maze` | Lot przez labirynt | gra 2D: AEGIS-7 leci tunelem, dziecko zmienia tor (↑ ↓, dotyk) i wlatuje w bramkę z angielskim słowem do polskiego słowa albo usłyszanego; dobra bramka ratuje zwierzaka, zła: odbicie, dobra świeci, słowo wraca; eksport `flyGame(S, words, opts)` |
| `sp-review` | Podsumowanie działów | dostępne po 3 przećwiczonych działach (`available(profile)`), film `review` → raport z działów → powtórka 10 najtrudniejszych słów |

- Działy: `special-data.js` (Unit 2: ubrania, pogoda, miesiące, przedmioty, this/that, my/your…, oraz dźwięki z misji 1–5). Własne słówka rodzica: `localStorage['rg.special.custom']`.
- `ctx.record`: `mission` = `sp-quiz:<dział>` (np. `sp-quiz:u2-weather`), dzięki temu wiadomo, które działy są przećwiczone; w sprawdzianie dodatkowo `test: true`.
- Film: `ctx.playStory(name, onDone)` zastępuje ekran misji; po filmie misja wraca na ten sam ekran.
- Minuty treningu: `profile.settings.quizMinutes` (domyślnie 10), `reviewMinutes` (8).
