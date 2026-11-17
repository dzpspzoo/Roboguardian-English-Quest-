"""Kompozycje muzyki do gry. Każda funkcja zwraca (Song, loop: bool).

Motyw AEGIS-7 (leitmotiv) przewija się przez wszystkie utwory:
    D5 . A4 D5 E5 | F5 . E5 D5 C5   (w d-moll), w wersjach durowych przeniesiony.
"""
import synth as S
from seq import Song, mel, voice, bass_note, chord_tones

I = S  # skrót


def arp(song, track, inst, prog, start_bar, base=62, pattern=(0, 1, 2, 3, 2, 1, 2, 3),
        step=0.5, vel=0.6, dur=None, bars_each=1):
    for i, ch in enumerate(prog):
        tones = chord_tones(ch, base, 4)
        bar0 = (start_bar + i * bars_each) * song.bpb
        nsteps = int(song.bpb * bars_each / step)
        for k in range(nsteps):
            m = tones[pattern[k % len(pattern)] % len(tones)]
            v = vel * (1.1 if k % int(2 / step if step < 1 else 1) == 0 else 0.85)
            song.note(track, inst, bar0 + k * step, dur or step * 0.9, m, v)


def bassline(song, track, inst, prog, start_bar, rhythm=((0, 4),), octave_lo=36, vel=0.8,
             bars_each=1, octave_jump=()):
    for i, ch in enumerate(prog):
        m = bass_note(ch, octave_lo)
        bar0 = (start_bar + i * bars_each) * song.bpb
        for k, (b, d) in enumerate(rhythm):
            mm = m + (12 if k in octave_jump else 0)
            song.note(track, inst, bar0 + b, d, mm, vel)


EIGHTHS = tuple((i * 0.5, 0.45) for i in range(8))
DRIVE = ((0, 0.45), (0.5, 0.45), (1, 0.45), (1.5, 0.45), (2, 0.45), (2.5, 0.45), (3, 0.45), (3.5, 0.45))

MOTIF_A = ("D5:1.5 A4:.5 D5 E5 | F5:1.5 E5:.5 D5 C5 | Bb4:1.5 C5:.5 D5 F5 | E5:3 A4 | "
           "D5:1.5 A4:.5 D5 E5 | F5:1.5 G5:.5 A5:2 | Bb5 A5 G5 F5 | E5:2 C#5 A4")
MOTIF_B = ("D5 F5 Bb5:1.5 A5:.5 | A5:2 G5 F5 | G5:1.5 E5:.5 C5 E5 | D5:3 A4 | "
           "D5 F5 Bb5 C6 | A5:2 C6 A5 | Bb5:1.5 A5:.5 G5 D5 | A5:2 G5 E5")
PROG_A = ["Dm", "Bb", "Gm", "C", "Dm", "F", "Gm", "A"]
PROG_B = ["Bb", "F", "C", "Dm", "Bb", "F", "Gm", "A7"]


# ====================================================================== MOTYW GŁÓWNY
def theme_main():
    s = Song(bpm=100, bars=32, seed=11)
    s.track("pad", gain=0.9, reverb=0.35)
    s.track("choir", gain=0.7, reverb=0.5)
    s.track("arp", gain=0.55, pan=0.25, reverb=0.25, delay=0.25, delay_beats=0.75)
    s.track("strings", gain=0.9, pan=-0.15, reverb=0.35)
    s.track("brass", gain=0.85, pan=0.1, reverb=0.3)
    s.track("bells", gain=0.5, pan=0.35, reverb=0.45)
    s.track("bass", gain=0.9, reverb=0.05)
    s.track("drums", gain=0.9, reverb=0.12)
    s.track("timp", gain=0.8, reverb=0.3)

    intro = ["Dm", "Bb", "Gm", "A"]
    bridge = ["Bb", "C", "Dm", "A"]
    # Intro 0-3
    s.chords("pad", I.inst_pad, intro, 0, lo=57, vel=0.6)
    arp(s, "arp", I.inst_pluck, intro, 0, base=62, vel=0.5)
    s.note("timp", I.inst_timpani, 12, 1, 38, 0.5)
    for b in (14, 14.5, 15, 15.25, 15.5, 15.75):
        s.note("timp", I.inst_timpani, b, 0.5, 38 if b < 15 else 45, 0.35 + 0.08 * (b - 14))
    # A1 4-11
    s.chords("pad", I.inst_pad, PROG_A, 4, lo=55, vel=0.65)
    arp(s, "arp", I.inst_pluck, PROG_A, 4, base=62, vel=0.45)
    s.melody("strings", I.inst_strings, mel(MOTIF_A), offset=16, vel=0.75)
    bassline(s, "bass", I.inst_bass, PROG_A, 4, rhythm=((0, 1.9), (2, 1.9)), octave_lo=38)
    s.pattern("drums", I.dr_kick, "x.......x.......", 4, 8, 0.7)
    s.pattern("drums", I.dr_hat, "..x...x...x...x.", 4, 8, 0.4)
    s.pattern("drums", I.dr_shaker, "xoxoxoxoxoxoxoxo", 4, 8, 0.5)
    # B 12-19
    s.chords("pad", I.inst_pad, PROG_B, 12, lo=55, vel=0.7)
    s.chords("choir", I.inst_choir, PROG_B, 12, lo=60, vel=0.5)
    arp(s, "arp", I.inst_pluck, PROG_B, 12, base=67, vel=0.4)
    s.melody("brass", I.inst_brass, mel(MOTIF_B), offset=48, vel=0.8)
    s.melody("strings", I.inst_strings, mel(MOTIF_B), offset=48, vel=0.55, transpose=-12)
    bassline(s, "bass", I.inst_bass, PROG_B, 12, rhythm=DRIVE, octave_lo=38, vel=0.7, octave_jump=(3, 7))
    s.pattern("drums", I.dr_kick, "x.....x...x.....", 12, 8, 0.8)
    s.pattern("drums", I.dr_snare, "....x.......x...", 12, 8, 0.55)
    s.pattern("drums", I.dr_hat, "x.x.x.x.x.x.x.x.", 12, 8, 0.4)
    s.hit("drums", I.dr_crash, 48, 0.6)
    # A2 20-27
    s.chords("pad", I.inst_pad, PROG_A, 20, lo=55, vel=0.7)
    s.chords("choir", I.inst_choir, PROG_A, 20, lo=60, vel=0.45)
    arp(s, "arp", I.inst_pluck, PROG_A, 20, base=62, vel=0.45)
    s.melody("brass", I.inst_brass, mel(MOTIF_A), offset=80, vel=0.85)
    s.melody("strings", I.inst_strings, mel(MOTIF_A), offset=80, vel=0.6, transpose=12)
    bells = mel("A5:2 D6:2 | F6:2 D6:2 | D6:2 Bb5:2 | G5:4 | A5:2 D6:2 | C6:2 A5:2 | D6:2 Bb5:2 | C#6:4")
    s.melody("bells", I.inst_glock, bells, offset=80, vel=0.5)
    bassline(s, "bass", I.inst_bass, PROG_A, 20, rhythm=DRIVE, octave_lo=38, vel=0.7, octave_jump=(3, 7))
    s.pattern("drums", I.dr_kick, "x.....x...x.....", 20, 7, 0.85)
    s.pattern("drums", I.dr_snare, "....x.......x...", 20, 7, 0.6)
    s.pattern("drums", I.dr_hat, "x.x.x.x.x.x.x.x.", 20, 7, 0.45)
    s.hit("drums", I.dr_crash, 80, 0.7)
    s.pattern("drums", I.dr_kick, "x.....x.........", 27, 1, 0.85)
    s.pattern("drums", I.dr_snare, "....x.......xxxx", 27, 1, 0.55)
    # Bridge 28-31: wyciszenie i powrót do intro
    s.chords("pad", I.inst_pad, bridge, 28, lo=55, vel=0.6)
    s.chords("choir", I.inst_choir, bridge, 28, lo=60, vel=0.4)
    s.melody("strings", I.inst_strings, mel("F5:4 | E5:4 | D5:4 | C#5:2 E5:2"), offset=112, vel=0.55)
    arp(s, "arp", I.inst_pluck, bridge, 28, base=62, vel=0.4)
    bassline(s, "bass", I.inst_bass, bridge, 28, rhythm=((0, 3.9),), octave_lo=38, vel=0.6)
    s.hit("drums", I.dr_crash, 112, 0.5)
    for k, m in enumerate([50, 50, 47, 47, 45, 45, 43, 43]):
        s.hit("drums", I.dr_tom, 124 + k * 0.5, 0.35 + k * 0.05, m=m)
    return s, True


# ====================================================================== HISTORIA
def story_creation():
    """Laboratorium: narodziny AEGIS-7. Tajemniczo, z zachwytem."""
    s = Song(bpm=76, bars=16, seed=21)
    s.track("pad", gain=0.9, reverb=0.5)
    s.track("bells", gain=0.55, pan=0.3, reverb=0.5, delay=0.3, delay_beats=0.75)
    s.track("glit", gain=0.35, pan=-0.35, reverb=0.6, delay=0.35, delay_beats=1.5)
    s.track("motif", gain=0.6, reverb=0.55)
    s.track("strings", gain=0.7, reverb=0.45)
    s.track("bass", gain=0.8, reverb=0.1)
    s.track("tick", gain=0.5, reverb=0.2)
    prog = ["Dmadd9", "Bbmaj7", "Gm7", "Asus4", "Dmadd9", "Bbmaj7", "Fmaj7", "A",
            "Bbmaj7", "C", "Dm", "Bbmaj7", "Gm7", "C", "Asus4", "A"]
    s.chords("pad", lambda m, d, v: I.inst_pad(m, d, v, bright=0.7), prog, 0, lo=53, vel=0.55)
    for i, ch in enumerate(prog):
        s.note("bass", I.inst_subbass, i * 4, 3.9, bass_note(ch, 26), 0.7)
    # dzwonki w szesnastkach
    pat = (0, 2, 1, 3, 2, 0, 3, 1)
    for i, ch in enumerate(prog):
        tones = chord_tones(ch, 74, 4)
        for k in range(16):
            v = 0.35 + (0.15 if k % 4 == 0 else 0)
            if i < 4 and k % 2 == 1:
                continue
            s.note("bells", I.inst_glock, i * 4 + k * 0.25, 0.25, tones[pat[k % 8]], v)
    # „obliczenia” robota: wysokie krótkie sygnały
    rng = s.rng
    scale = [74, 76, 77, 79, 81, 84, 86, 88, 89]
    for k in range(40):
        b = rng.uniform(0, 64)
        s.note("glit", lambda m, d, v: I.inst_bell(m, d, v, ratio=2.0, index=0.6, decay=0.4),
               round(b * 4) / 4, 0.2, int(rng.choice(scale)), 0.25)
    # motyw w powiększeniu (wolno) na celeście
    s.melody("motif", lambda m, d, v: I.inst_bell(m, d, v, ratio=1.0, index=1.4, decay=1.8),
             mel("D5:3 A4:1 | D5:2 E5:2 | F5:3 E5:1 | D5:2 C#5:2"), offset=16, vel=0.7)
    s.melody("motif", lambda m, d, v: I.inst_bell(m, d, v, ratio=1.0, index=1.4, decay=1.8),
             mel("D5:3 C5:1 | E5:2 G5:2 | F5:3 E5:1 | D5:4 | Bb4:2 D5:2 | G5:2 E5:2 | E5:4 | C#5:4"),
             offset=32, vel=0.7)
    s.melody("strings", I.inst_strings, mel("D4:8 | Bb3:4 C4:4 | D4:4 F4:4 | E4:8"), offset=32, vel=0.45)
    s.melody("strings", I.inst_strings, mel("F4:8 | G4:4 E4:4 | F4:4 A4:4 | A4:4 C#5:4"), offset=32, vel=0.4)
    # zegar/mechanizm
    s.pattern("tick", I.dr_rim, "x.o.x.o.x.o.x.o.", 4, 12, 0.25)
    return s, True


def story_family():
    """Życie z rodziną: ciepło, bezpiecznie, G-dur."""
    s = Song(bpm=84, bars=16, seed=31)
    s.track("ep", gain=0.85, pan=-0.1, reverb=0.3)
    s.track("melody", gain=0.75, pan=0.1, reverb=0.35)
    s.track("strings", gain=0.6, reverb=0.4)
    s.track("bass", gain=0.75, reverb=0.08)
    s.track("perc", gain=0.6, reverb=0.15)
    s.track("bells", gain=0.4, pan=0.3, reverb=0.45)
    prog = ["G", "D/F#", "Em", "C", "G", "Bm", "C", "D",
            "Em", "C", "G", "D", "C", "D", "G", "G"]
    # e-piano: łamane akordy (bas, kwinta, tercja wyżej)
    for i, ch in enumerate(prog):
        r = bass_note(ch, 43)
        tones = voice(ch, 59)
        seq = [r, tones[0], tones[1], tones[2], tones[1], tones[0], tones[1], tones[2]]
        for k, m in enumerate(seq):
            s.note("ep", I.inst_epiano, i * 4 + k * 0.5, 0.9, m, 0.45 if k else 0.55)
    melody = ("G4:1.5 D4:.5 G4 A4 | B4:1.5 A4:.5 G4 F#4 | E4:1.5 F#4:.5 G4 B4 | G4:3 D4 | "
              "G4:1.5 D4:.5 G4 A4 | B4:1.5 C5:.5 D5:2 | E5 D5 C5 B4 | A4:2 F#4 D4 | "
              "r:16 | "
              "E5:2 D5 C5 | D5:2 C5 A4 | B4:4 | r:4")
    s.melody("melody", I.inst_flute, mel(melody), offset=0, vel=0.7, transpose=12)
    # druga połowa: kontrapunkt smyczków
    s.melody("strings", I.inst_strings, mel("B4:4 | C5:4 | D5:4 | A4:4 | G4:4 | A4:4 | B4:8"), offset=32, vel=0.5)
    s.melody("strings", I.inst_strings, mel("G4:4 | E4:4 | G4:4 | F#4:4 | E4:4 | F#4:4 | D4:8"), offset=32, vel=0.45)
    s.melody("bells", I.inst_glock, mel("B5:2 G5:2 | C6:2 G5:2 | D6:2 B5:2 | A5:4"), offset=32, vel=0.4)
    for i, ch in enumerate(prog):
        b = bass_note(ch, 36)
        s.note("bass", I.inst_bass, i * 4, 1.8, b, 0.6, cutoff=450)
        s.note("bass", I.inst_bass, i * 4 + 2.5, 1.3, b if i % 2 else b + 7, 0.5, cutoff=450)
    s.pattern("perc", I.dr_shaker, "x.o.x.o.x.o.x.o.", 0, 16, 0.6)
    s.pattern("perc", I.dr_rim, "....x.......x...", 8, 8, 0.35)
    return s, True


def story_attack():
    """Atak: napięcie, szybki rytm, d-moll. Bez przerażania dzieci, raczej przygodowo."""
    s = Song(bpm=140, bars=24, seed=41)
    s.track("ost", gain=0.85, pan=-0.2, reverb=0.2)
    s.track("ost2", gain=0.5, pan=0.25, reverb=0.25)
    s.track("brass", gain=0.85, reverb=0.3)
    s.track("pad", gain=0.6, reverb=0.4)
    s.track("bass", gain=0.85, reverb=0.05)
    s.track("drums", gain=1.0, reverb=0.15)
    s.track("taiko", gain=0.9, reverb=0.3)
    s.track("fx", gain=0.6, reverb=0.4)
    prog = ["Dm", "Dm", "Bb", "Bb", "Gm", "Gm", "A", "A"]
    full = prog * 3
    # ostinato smyczków w ósemkach
    ost = [0, 0, 12, 0, 0, 0, 13, 12]  # względem d3/bas akordu
    for i, ch in enumerate(full):
        r = bass_note(ch, 50)
        for k in range(8):
            off = ost[k]
            m = r + (off if off != 13 else 1)
            s.note("ost", I.inst_short_strings, i * 4 + k * 0.5, 0.4, m, 0.7 if k % 4 == 0 else 0.55)
    # druga warstwa w sekcji 2 i 3 (szesnastki w górze)
    for i, ch in enumerate(full[8:]):
        tones = chord_tones(ch, 69, 3)
        for k in range(16):
            s.note("ost2", I.inst_short_strings, (i + 8) * 4 + k * 0.25, 0.2, tones[k % 3], 0.4)
    s.chords("pad", I.inst_pad, full, 0, lo=55, vel=0.45)
    for i, ch in enumerate(full):
        b = bass_note(ch, 38)
        for k in range(8):
            s.note("bass", I.inst_bass, i * 4 + k * 0.5, 0.4, b, 0.75 if k % 2 == 0 else 0.55)
    # stabs dęciaków na zmianę akordu
    for i in range(0, 24, 2):
        for m in voice(full[i], 57):
            s.note("brass", I.inst_brass, i * 4, 0.6, m, 0.55)
            s.note("brass", I.inst_brass, i * 4 + 1.5, 0.4, m, 0.45)
    # motyw bohatera w sekcji 3 (dęciaki, niżej)
    s.melody("brass", I.inst_brass, mel("D4:1.5 A3:.5 D4 E4 | F4:3 E4 | D4:1.5 A3:.5 D4 E4 | F4:2 G4:2 | "
                                        "Bb4:3 A4 | G4:2 F4:2 | E4:4 | C#4:2 E4:2"),
             offset=64, vel=0.85)
    s.melody("brass", I.inst_brass, mel("D4:1.5 A3:.5 D4 E4 | F4:3 E4 | D4:1.5 A3:.5 D4 E4 | F4:2 G4:2 | "
                                        "Bb4:3 A4 | G4:2 F4:2 | E4:4 | C#4:2 E4:2"),
             offset=64, vel=0.6, transpose=12)
    # bębny
    s.pattern("taiko", I.dr_taiko, "x..x..x...x.x...", 0, 24, 0.7)
    s.pattern("drums", I.dr_hat, "x.x.x.x.x.x.x.x.", 0, 8, 0.35)
    s.pattern("drums", I.dr_hat, "xxxxxxxxxxxxxxxx", 8, 16, 0.3)
    s.pattern("drums", I.dr_snare, "....x.......x...", 8, 16, 0.55)
    s.pattern("drums", I.dr_kick, "x.......x.x.....", 8, 16, 0.75)
    for sec in (0, 32, 64):
        s.hit("drums", I.dr_crash, sec, 0.55)
    # werble przed sekcjami
    for sec_end in (32, 64, 96):
        for k in range(8):
            s.hit("drums", I.dr_snare, sec_end - 2 + k * 0.25, 0.3 + k * 0.06)
        s.hit("fx", lambda vel: I.riser(60 / 140 * 4, 400, 8000, vel), sec_end - 4, 0.6)
    return s, True


def story_crash():
    """Po rozbiciu: smutno, cicho, ale z iskrą nadziei."""
    s = Song(bpm=64, bars=12, seed=51)
    s.track("pad", gain=0.85, reverb=0.55)
    s.track("piano", gain=0.85, reverb=0.45)
    s.track("strings", gain=0.6, reverb=0.5)
    s.track("drone", gain=0.6, reverb=0.3)
    s.track("bells", gain=0.35, pan=0.3, reverb=0.7, delay=0.3, delay_beats=1.5)
    prog = ["Dm", "Bb", "Gm", "A", "Dm", "Bb", "Gm", "Asus4", "Bb", "F", "Gm", "A"]
    s.chords("pad", lambda m, d, v: I.inst_pad(m, d, v, bright=0.55), prog, 0, lo=53, vel=0.5)
    for i in range(12):
        s.note("drone", I.inst_subbass, i * 4, 3.95, 38 if i < 8 else bass_note(prog[i], 34), 0.55)
    # „pianino” gra motyw w łamanej, zmęczonej wersji
    s.melody("piano", I.inst_epiano, mel(
        "r:1 D5:1.5 A4:.5 D5 | F5:2 E5 D5 | D5:3 Bb4 | C#5:4 | "
        "r:1 D5:1.5 A4:.5 D5 | F5:2 G5 F5 | E5:2 D5:2 | E5:4 | "
        "D5:2 F5:2 | A5:3 G5 | F5:2 E5 D5 | E5:2 C#5:2"), vel=0.6)
    for i, ch in enumerate(prog):
        for k, m in enumerate(voice(ch, 50)):
            s.note("piano", I.inst_epiano, i * 4 + k * 0.33, 3.0, m, 0.32)
    s.melody("strings", I.inst_strings, mel("r:32 | D4:4 | C4:4 | Bb3:4 | A3:4"), vel=0.45)
    s.melody("strings", I.inst_strings, mel("r:32 | F4:4 | A4:4 | D5:4 | C#5:4"), vel=0.4)
    s.melody("bells", I.inst_glock, mel("r:34 A5:2 | r:4 | r:2 D6:2 | r:4"), vel=0.25)
    return s, True


def story_hangar():
    """Hangar: odbudowa, nadzieja, F-dur, lekki warsztatowy rytm."""
    s = Song(bpm=96, bars=16, seed=61)
    s.track("pad", gain=0.75, reverb=0.4)
    s.track("arp", gain=0.55, pan=-0.25, reverb=0.3, delay=0.25, delay_beats=0.75)
    s.track("lead", gain=0.7, pan=0.1, reverb=0.35)
    s.track("bass", gain=0.8, reverb=0.08)
    s.track("perc", gain=0.7, reverb=0.25)
    s.track("clank", gain=0.6, pan=0.3, reverb=0.45)
    prog = ["F", "C", "Dm", "Bb", "F", "C", "Bb", "C",
            "Dm", "Bb", "F", "C", "Dm", "Bb", "C", "C"]
    s.chords("pad", lambda m, d, v: I.inst_pad(m, d, v, bright=0.8), prog, 0, lo=55, vel=0.55)
    arp(s, "arp", I.inst_pluck, prog, 0, base=65, pattern=(0, 2, 1, 3, 0, 2, 1, 3), vel=0.45)
    for i, ch in enumerate(prog):
        b = bass_note(ch, 36)
        for (bt, d) in ((0, 1.4), (1.5, 0.4), (2, 1.4), (3.5, 0.4)):
            s.note("bass", I.inst_bass, i * 4 + bt, d, b, 0.6, cutoff=500)
    s.melody("lead", I.inst_flute, mel(
        "D5:1.5 A4:.5 D5 E5 | F5:1.5 E5:.5 D5 C5 | C5:1.5 D5:.5 F5 A5 | G5:3 r | "
        "D5:1.5 A4:.5 D5 E5 | F5:1.5 G5:.5 F5 D5 | E5:2 G5:2 | G5:4"), offset=32, vel=0.7)
    s.melody("lead", I.inst_glock, mel("r:4 C6:2 A5:2 | r:4 G5:2 F5:2 | r:4 A5:2 C6:2 | r:4 E5:4"),
             offset=0, vel=0.35)
    s.pattern("perc", I.dr_kick, "x.......x.......", 4, 12, 0.5)
    s.pattern("perc", I.dr_hat, "..x...x...x...x.", 0, 16, 0.35)
    s.pattern("perc", I.dr_shaker, "xoxoxoxoxoxoxoxo", 8, 8, 0.45)
    s.pattern("clank", I.dr_clank, "....x.........x.", 0, 16, 0.45)
    s.pattern("clank", I.dr_rim, ".......x.....x..", 0, 16, 0.3)
    return s, True


# ====================================================================== MISJE
def mission_calm():
    """Tło do nauki: lekkie, pogodne, bez wyraźnej melodii (nie przeszkadza lektorowi)."""
    s = Song(bpm=108, bars=16, seed=71)
    s.track("marimba", gain=0.75, pan=-0.2, reverb=0.25)
    s.track("pluck", gain=0.45, pan=0.25, reverb=0.3, delay=0.2, delay_beats=0.75)
    s.track("pad", gain=0.55, reverb=0.35)
    s.track("bass", gain=0.8, reverb=0.05)
    s.track("drums", gain=0.7, reverb=0.1)
    prog = ["C", "Am", "F", "G", "C", "Em", "F", "G",
            "Am", "F", "C", "G", "F", "G", "C", "Csus4"]
    s.chords("pad", lambda m, d, v: I.inst_pad(m, d, v, bright=0.6), prog, 0, lo=55, vel=0.4)
    mpat = [(0, 0), (0.75, 1), (1.5, 2), (2, 1), (2.75, 0), (3.5, 2)]
    for i, ch in enumerate(prog):
        tones = chord_tones(ch, 60, 3)
        for bt, idx in mpat:
            s.note("marimba", I.inst_marimba, i * 4 + bt, 0.5, tones[idx], 0.55)
    # małe wtrącenia pluckiem co 2 takty
    for i in range(1, 16, 2):
        tones = chord_tones(prog[i], 72, 3)
        s.note("pluck", I.inst_pluck, i * 4 + 2, 0.4, tones[2], 0.4)
        s.note("pluck", I.inst_pluck, i * 4 + 2.5, 0.4, tones[1], 0.35)
        s.note("pluck", I.inst_pluck, i * 4 + 3, 0.8, tones[0], 0.35)
    for i, ch in enumerate(prog):
        b = bass_note(ch, 36)
        for (bt, d, o) in ((0, 0.9, 0), (1.5, 0.4, 0), (2, 0.9, 7), (3, 0.4, 12)):
            s.note("bass", I.inst_bass, i * 4 + bt, d, b + o if o != 7 else b + 7, 0.55, cutoff=500)
    s.pattern("drums", I.dr_kick, "x.......x.......", 0, 16, 0.55)
    s.pattern("drums", I.dr_clap, "....x.......x...", 0, 16, 0.35)
    s.pattern("drums", I.dr_shaker, "xoxoxoxoxoxoxoxo", 0, 16, 0.45)
    return s, True


def mission_action():
    """Misje na czas / zręcznościowe: energicznie, a-moll."""
    s = Song(bpm=124, bars=16, seed=81)
    s.track("arp", gain=0.5, pan=0.2, reverb=0.2, delay=0.2, delay_beats=0.75)
    s.track("pad", gain=0.5, reverb=0.3)
    s.track("stab", gain=0.6, pan=-0.15, reverb=0.25)
    s.track("lead", gain=0.5, reverb=0.3)
    s.track("bass", gain=0.85, reverb=0.04)
    s.track("drums", gain=0.85, reverb=0.1)
    prog = ["Am", "F", "C", "G"] * 4
    s.chords("pad", lambda m, d, v: I.inst_pad(m, d, v, bright=0.7), prog, 0, lo=57, vel=0.4)
    arp(s, "arp", I.inst_pluck, prog, 0, base=69, pattern=(0, 1, 2, 1), step=0.25, vel=0.4)
    for i, ch in enumerate(prog):
        b = bass_note(ch, 33)
        for k in range(8):
            s.note("bass", I.inst_bass, i * 4 + k * 0.5, 0.4, b + (12 if k in (3, 7) else 0), 0.65)
    for i in range(16):
        for m in voice(prog[i], 60):
            s.note("stab", I.inst_brass, i * 4 + 1.5, 0.35, m, 0.4)
            s.note("stab", I.inst_brass, i * 4 + 3.5, 0.35, m, 0.35)
    s.melody("lead", I.inst_lead, mel(
        "A5:1.5 E5:.5 A5 B5 | C6:1.5 B5:.5 A5 G5 | E5:3 G5 | D5:4 | "
        "A5:1.5 E5:.5 A5 B5 | C6:1.5 D6:.5 E6:2 | D6 C6 B5 G5 | B5:4"), offset=32, vel=0.6)
    s.pattern("drums", I.dr_kick, "x...x...x...x...", 0, 16, 0.75)
    s.pattern("drums", I.dr_clap, "....x.......x...", 4, 12, 0.45)
    s.pattern("drums", I.dr_hat, "..x...x...x...x.", 0, 16, 0.45)
    s.pattern("drums", I.dr_hat, "x.x.x.x.x.x.x.x.", 8, 8, 0.25)
    s.hit("drums", I.dr_crash, 32, 0.5)
    for k in range(4):
        s.hit("drums", I.dr_tom, 60 + k * 0.5 + 2, 0.4 + k * 0.05, m=[52, 50, 47, 45][k])
    return s, True


# ====================================================================== KRÓTKIE SYGNAŁY
def reward_fanfare():
    s = Song(bpm=120, bars=2, seed=91)
    s.track("brass", gain=1.0, reverb=0.35)
    s.track("bells", gain=0.5, pan=0.3, reverb=0.4)
    s.track("drums", gain=0.8, reverb=0.25)
    s.melody("brass", I.inst_brass, mel("A4:.25 D5:.25 F#5:.25 A5:3"), vel=0.85)
    for m in (62, 66, 69):
        s.note("brass", I.inst_brass, 0.75, 3, m, 0.6)
    s.note("brass", I.inst_bass, 0.75, 3, 38, 0.7)
    for k, m in enumerate((74, 78, 81, 86, 90, 93)):
        s.note("bells", I.inst_glock, 0.75 + k * 0.125, 0.3, m, 0.5)
    s.note("drums", I.inst_timpani, 0.75, 1, 38, 0.8)
    s.hit("drums", I.dr_crash, 0.75, 0.6)
    return s, False


def level_complete():
    s = Song(bpm=112, bars=3, seed=92)
    s.track("brass", gain=1.0, reverb=0.35)
    s.track("strings", gain=0.6, reverb=0.4)
    s.track("bells", gain=0.5, pan=0.3, reverb=0.45)
    s.track("bass", gain=0.8, reverb=0.1)
    s.track("drums", gain=0.85, reverb=0.25)
    s.melody("brass", I.inst_brass, mel("D5:.75 A4:.25 D5:.5 E5:.5 | F#5:1.5 E5:.5 | F#5:.5 G5:.5 A5:1 | A5:4"),
             vel=0.85)
    prog = [("D", 0, 4), ("G", 4, 1), ("A7", 5, 1), ("D", 6, 4)]
    for ch, b, d in prog:
        for m in voice(ch, 57):
            s.note("strings", I.inst_strings, b, d, m, 0.55)
        s.note("bass", I.inst_bass, b, d, bass_note(ch, 38), 0.7)
    for k in range(12):
        s.hit("drums", I.dr_snare, 4.5 + k * (1.5 / 12), 0.25 + k * 0.04)
    s.note("drums", I.inst_timpani, 6, 1, 38, 0.8)
    s.hit("drums", I.dr_crash, 6, 0.7)
    s.hit("drums", I.dr_kick, 6, 0.8)
    for k, m in enumerate((74, 78, 81, 86, 81, 86, 90, 93)):
        s.note("bells", I.inst_glock, 6 + k * 0.125, 0.3, m, 0.45)
    return s, False


def try_again():
    """Łagodne „spróbuj jeszcze raz” – zachęca, nie karze."""
    s = Song(bpm=120, bars=1, seed=93)
    s.track("mar", gain=1.0, reverb=0.3)
    s.track("bells", gain=0.5, reverb=0.4)
    s.melody("mar", I.inst_marimba, mel("E5:.5 C5:.5 r:.25 D5:.25 G5:1"), vel=0.75)
    s.melody("mar", I.inst_marimba, mel("C4:.5 A3:.5 r:.25 B3:.25 G3:1"), vel=0.5)
    s.note("bells", I.inst_glock, 1.5, 0.5, 79, 0.35)
    return s, False


SONGS = {
    "theme_main": theme_main,
    "story_creation": story_creation,
    "story_family": story_family,
    "story_attack": story_attack,
    "story_crash": story_crash,
    "story_hangar": story_hangar,
    "mission_calm": mission_calm,
    "mission_action": mission_action,
    "reward_fanfare": reward_fanfare,
    "level_complete": level_complete,
    "try_again": try_again,
}
