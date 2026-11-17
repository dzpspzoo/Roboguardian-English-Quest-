# Grafika – Roboguardian English Quest

Cała grafika jest narysowana kodem (`tools/gfx/`), więc jest własna i może być publiczna.
Font Fredoka: SIL Open Font License 1.1 (Google Fonts).

- `theme.css` – zmienne `--rg-*` (nazwy wspólne z `src/core/app.css`) i klasy `.rg-btn`, `.rg-panel`, `.rg-subtitle`, `.rg-bubble`, `.rg-progress`, `.rg-choice`, `.rg-stars`.
- `characters/<postać>/<poza>.svg` – wspólna skala: viewBox 400×600, podłoga y=585, środek x=200.
  - `aegis7`: idle, wave, guard, protect, ready, hug, damaged, off, `assembly.svg` (do składania).
  - `mom`, `dad`, `leo`, `mia`: idle, happy, wave, scared, point, hold.
  - `kraken`: idle, aim, stunned · `kraken-commander`: idle, aim · `drone`, `kraken-ship`.
- `backgrounds/*.svg` – 1920×1080, `start.svg` = tło ekranu startowego.
- `ui/icons/*.svg` – 24×24, kolor przez `currentColor` (wstaw inline albo użyj jako maski CSS).
- `ui/parts/*.svg` – kolorowe ikony części robota (nagrody).
- `ui/logo.svg` – logo gry.
- `manifest.json` – id → ścieżka.

## Robot w trakcie składania
Wstaw `characters/aegis7/assembly.svg` inline (fetch + innerHTML). Części mają id
`part-head, part-torso, part-pelvis, part-thigh-l/r, part-shin-l/r, part-upperarm-l/r, part-forearm-l/r, part-shoulder-l/r`.
Brakującym dodaj klasę `rg-missing` (hologram), nowo dodanej `rg-new` (animacja montażu).

## Zmiany
`pip install fonttools brotli` i `python tools/gfx/build.py` – przerysowuje wszystko, także `assets/story/img/s01–s10.svg`.
