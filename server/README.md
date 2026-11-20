# Serwer AEGIS AI (Cloudflare Worker)

Mały serwer pośredniczący między grą a Claude API. Jest potrzebny, bo klucza API nie wolno trzymać w grze
(każdy mógłby go podejrzeć w przeglądarce). Serwer:

- trzyma klucz API jako sekret (nie ma go w repozytorium ani w grze),
- wpuszcza tylko grę, która zna **hasło gry** (`GAME_TOKEN`),
- pilnuje limitów: łącznie **250 USD** (`BUDGET_USD`) i **2 USD dziennie** (`DAILY_USD`), plus maks. 60 wypowiedzi i 3 analizy dziennie,
- wysyła do Claude tylko tekst rozmowy i anonimowe liczby z testu (bez imienia dziecka i bez nagrań głosu),
- ma stałe, bezpieczne instrukcje dla AI: AEGIS mówi krótko po angielsku, na poziomie A1, nie pyta o dane osobowe.

Co robi AI w grze:

1. **Rozmowa z AEGIS-em** w Misji dnia: krótka (2 odpowiedzi dziecka) w dni nauki i dłuższa (4 odpowiedzi) w dni rozmowy.
   Dziecko klika jedną z 3 podpowiedzi, pisze albo (gdy włączysz) mówi. Gdy napisze z błędem, AEGIS pokazuje i czyta
   poprawne zdanie. Polski lektor odzywa się tylko wtedy, gdy AEGIS nie zrozumiał odpowiedzi.
2. **Analiza testu startowego i postępów**: po teście startowym gra sama prosi AI o plan (przy najbliższym pożegnaniu
   po misji), można też kliknąć przycisk w panelu rodzica. Plan ustawia liczbę nowych zwrotów dziennie (1–3),
   długość misji (8–14 min) i dźwięki do ćwiczenia, a rodzic dostaje opis po polsku i 2–3 pomysły na 5 minut w domu.

Bez serwera gra działa jak dotąd, tylko bez tych dwóch rzeczy.

## Ile to kosztuje

Model `claude-opus-5-5` (4 USD za mln tokenów wejścia, 20 USD za mln tokenów wyjścia). Szacunek:
jedna wypowiedź AEGIS-a ok. 0,01–0,02 USD, Misja dnia z rozmową ok. 0,03–0,10 USD, analiza testu ok. 0,05–0,20 USD.
Przy codziennej grze to zwykle **2–4 USD miesięcznie**. Dzienny limit 2 USD chroni przed niespodzianką.
Taniej: zmienna `MODEL` = `claude-sonnet-5-5` (ok. 2 razy taniej) albo `claude-haiku-5-5` (kilkadziesiąt razy taniej, ale słabsza rozmowa).

## Krok po kroku (ok. 20 minut, bez programowania)

Klucz API i hasło gry wpisujesz **tylko** w panelu Anthropic i Cloudflare. Nie wysyłaj ich w czacie, mailu ani do repozytorium.

### A. Klucz Claude API (Anthropic)

1. Wejdź na <https://console.anthropic.com> i załóż konto (albo zaloguj się).
2. **Billing**: doładuj konto kwotą przedpłaconą, np. 20 USD, i **nie włączaj automatycznego doładowania**.
   Przedpłata to najprostszy twardy limit: gdy się skończy, AI przestaje działać, a gra działa dalej bez niego.
3. **Limits** (limity wydatków): jeśli jest dostępne, ustaw miesięczny limit, np. 20 USD.
4. **API Keys** → **Create Key**, nazwa np. `aegis-teacher`. Skopiuj klucz (zaczyna się od `sk-ant-`); pokazuje się tylko raz.
   Trzymaj go chwilę w schowku albo w menedżerze haseł, do kroku B6.

### B. Serwer w Cloudflare (darmowy plan wystarcza)

1. Wejdź na <https://dash.cloudflare.com> i załóż darmowe konto.
2. Menu **Storage & Databases → KV** (Workers KV) → **Create** → nazwa `rg-teacher` → **Add**.
   (Tu serwer liczy wydatki.)
3. Menu **Compute (Workers) → Workers & Pages → Create → Create Worker** (szablon „Hello World”),
   nazwa `aegis-teacher` → **Deploy**.
4. **Edit code**: usuń cały przykładowy kod i wklej całą zawartość pliku `server/worker.js` z repozytorium
   (na GitHubie: otwórz plik → przycisk **Raw** → zaznacz wszystko → kopiuj). Kliknij **Deploy**.
5. Wróć do workera → **Settings → Bindings → Add → KV namespace**:
   nazwa zmiennej **`RG_KV`**, przestrzeń `rg-teacher` → **Save/Deploy**.
6. **Settings → Variables and Secrets → Add** (po kolei):

   | Typ | Nazwa | Wartość |
   |---|---|---|
   | Secret | `ANTHROPIC_API_KEY` | klucz z kroku A4 |
   | Secret | `GAME_TOKEN` | wymyślone hasło gry, np. 4 przypadkowe słowa bez spacji (min. 16 znaków) |
   | Text | `MODEL` | `claude-opus-5-5` |
   | Text | `BUDGET_USD` | `250` |
   | Text | `DAILY_USD` | `2` |
   | Text | `ALLOWED_ORIGIN` | `https://dzpspzoo.github.io` |

   Kliknij **Deploy**. Hasło gry zapisz sobie (będzie potrzebne w kroku C2 na każdym urządzeniu, na którym gra syn).
7. Na stronie workera skopiuj jego adres, np. `https://aegis-teacher.twoja-nazwa.workers.dev`.
   Test: otwarcie tego adresu w przeglądarce ma pokazać `{"error":"token"}`. To dobrze: bez hasła serwer nikogo nie wpuszcza.

### C. Połączenie gry z serwerem

1. W grze otwórz **Panel rodzica** → sekcja **Nauczyciel AEGIS-7** → **AEGIS AI: rozmowa i plan nauki**.
2. Wpisz **Adres serwera** (krok B7) i **Hasło gry** (krok B6) → **Zapisz i sprawdź**.
   Ma się pojawić: „✅ Połączono. Wydano 0.00 z 250 USD”.
3. Jeśli test startowy jest już zrobiony, kliknij **Przeanalizuj test startowy i postępy** (do minuty).
   Plan od AI pojawi się w panelu i od razu zmieni kolejne Misje dnia.
4. Opcjonalnie: **Odpowiedź głosem (mikrofon)** = włączona. Uwaga: rozpoznawanie mowy w Chrome przetwarza nagranie
   na serwerach Google. Bez tego syn odpowiada kafelkiem z podpowiedzią albo pisze.

Ustawienie adresu i hasła jest zapisane w tej przeglądarce (nie w profilu dziecka). Na drugim urządzeniu wpisz je ponownie.

## Bezpieczeństwo i prywatność

- Klucz API jest tylko w Cloudflare (sekret). Gdyby wyciekł, usuń go w Anthropic Console (API Keys) i wpisz nowy w kroku B6.
- Hasło gry chroni przed obcymi. Kto je zna, może wydać najwyżej dzienny limit (`DAILY_USD`). Zmiana: nowa wartość `GAME_TOKEN` w Cloudflare i w panelu rodzica.
- Do AI trafia: temat rozmowy, lista poznanych zwrotów, ostatnie wypowiedzi z rozmowy oraz przy analizie anonimowe wyniki testu i misji.
  Nie trafia: imię, nagrania, adres. AEGIS ma zakaz pytania o dane osobowe.
- Rozmowy (ostatnie 10) zapisują się tylko w przeglądarce; rodzic widzi je w panelu.
- AI można wyłączyć w panelu rodzica (Rozmowa z AI: wyłączona). Gra działa wtedy bez sieci jak wcześniej.

## Dla programisty

- `worker.js`: Messages API przez `fetch` (bez SDK, żeby dało się wkleić w edytor Cloudflare), structured outputs
  (`output_config.format` z JSON Schema), `effort: low`, `fallbacks: "default"` przy odmowie modelu. Koszt liczony z `usage` i zapisywany w KV.
- Trasy: `GET /status`, `POST /chat`, `POST /analyze`; nagłówek `X-Game-Token`.
- Z wiersza poleceń zamiast kroków B: `npx wrangler kv namespace create RG_KV` (id do `wrangler.toml`),
  `npx wrangler secret put ANTHROPIC_API_KEY`, `npx wrangler secret put GAME_TOKEN`, `npx wrangler deploy`.
- Testy (z atrapą API, bez sieci): `node --test src/teacher/tests/*.mjs`.
