# Generator muzyki i efektów

Cała muzyka i efekty gry powstają tutaj z kodu (własny syntezator: oscylatory, szum, filtry, pogłos).
Nie ma w nich cudzych próbek ani nagrań, więc można je swobodnie publikować (licencja CC BY 4.0, jak w manifeście).

```
pip install numpy scipy        # + ffmpeg z libmp3lame
python tools/audio-gen/build.py                 # wszystko
python tools/audio-gen/build.py theme_main star # wybrane id
```

Wynik: `assets/audio/music/*.mp3`, `assets/audio/sfx/*.mp3`, `assets/audio/manifest.json`.

- `synth.py` – instrumenty, perkusja, filtry, pogłos.
- `seq.py` – zapis nut i akordów, renderowanie; pętle są renderowane okresowo (plik ma 0,5 s zakładki przed
  `loopStart` i 1,5 s po `loopEnd`), więc grają bez przerwy w Web Audio nawet gdy dekoder MP3 przesunie dźwięk.
- `music.py` – kompozycje. Motyw AEGIS-7 (`MOTIF_A`) wraca w scenach historii.
- `sfx.py` – efekty.

Nowy nastrój: dopisz funkcję w `music.py`, dodaj ją do `SONGS` i do `MUSIC_INFO` w `build.py`.
