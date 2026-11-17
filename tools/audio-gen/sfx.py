"""Efekty dźwiękowe gry (krótkie, przyjazne dla dziecka, bez ostrych dźwięków)."""
import numpy as np
import synth as S


def _cat(parts, total=None):
    """parts: [(czas_s, mono)] -> jeden sygnał mono."""
    end = max(S.nsamp(t) + len(x) for t, x in parts)
    out = np.zeros(total or end)
    for t, x in parts:
        i = S.nsamp(t)
        seg = x[: len(out) - i]
        out[i: i + len(seg)] += seg
    return out


def _small_room(x, wet=0.18, length=0.6):
    ir = S.make_reverb_ir(length, 0.15, 7000, seed=9)
    st = S.stereo(x)
    return st + S.reverb(np.vstack([np.pad(st[0], (0, S.nsamp(length))), np.pad(st[1], (0, S.nsamp(length)))]), ir)[:, : st.shape[1]] * wet


def click():
    n = S.nsamp(0.06)
    t = np.arange(n) / S.SR
    y = np.sin(2 * np.pi * 1400 * t) * np.exp(-t / 0.008)
    y += S.hp(S.noise(n), 3000) * np.exp(-t / 0.003) * 0.3
    return y * 0.6


def correct():
    a = S.inst_bell(S.note_to_midi("E6"), 0.2, 0.9, ratio=2.0, index=1.0, decay=0.35)
    b = S.inst_bell(S.note_to_midi("B6"), 0.4, 0.9, ratio=2.0, index=1.0, decay=0.6)
    c = S.inst_glock(S.note_to_midi("E7"), 0.3, 0.4)
    return _cat([(0, a), (0.09, b), (0.09, c * 0.6)]) * 1.6


def wrong():
    """Miękkie „bum-bum” w dół (nie brzęczyk)."""
    out = []
    for i, (f0, t0) in enumerate(((330, 0.0), (262, 0.16))):
        n = S.nsamp(0.28)
        t = np.arange(n) / S.SR
        fr = f0 * (1 - 0.08 * t / 0.28)
        y = S.lp(S.square(fr, 0.0, 0.4), 1200) * np.exp(-t / 0.09)
        y += np.sin(2 * np.pi * np.cumsum(fr / 2) / S.SR) * np.exp(-t / 0.1) * 0.6
        out.append((t0, y))
    return _cat(out) * 0.55


def star():
    notes = ["C6", "E6", "G6", "C7", "E7"]
    parts = [(i * 0.055, S.inst_glock(S.note_to_midi(nm), 0.2, 0.7)) for i, nm in enumerate(notes)]
    n = S.nsamp(0.8)
    t = np.arange(n) / S.SR
    shimmer = S.hp(S.noise(n), 8000) * (t / 0.2) * np.exp(-t / 0.15) * 0.15
    parts.append((0.05, shimmer))
    return _cat(parts) * 1.4


def part_attach():
    """Część robota wskakuje na miejsce: serwo, stuk, zamek."""
    n = S.nsamp(0.32)
    t = np.arange(n) / S.SR
    fr = 260 + 380 * (t / 0.32) ** 0.7
    servo = S.lp(S.square(fr, 0.0, 0.3) + 0.5 * S.saw(fr * 2.01), 1800) * 0.25
    servo *= np.minimum(1, t / 0.02) * np.minimum(1, (0.32 - t) / 0.03)
    thud = S.dr_kick(0.8, tight=0.5)
    clank = S.dr_clank(1.2)
    lock = click() * 0.8
    tail = S.inst_bell(S.note_to_midi("A5"), 0.3, 0.5, ratio=2.0, index=0.8, decay=0.4)
    return _cat([(0, servo), (0.3, thud), (0.3, clank), (0.42, lock), (0.45, tail)]) * 1.1


def power_up():
    length = 0.9
    n = S.nsamp(length)
    t = np.arange(n) / S.SR
    fr = 160 * (1200 / 160) ** (t / length) ** 1.3
    y = S.saw(fr) * 0.5 + S.square(fr * 1.5, 0.0) * 0.3
    y = S.sweep_filter(y, 400 + 6000 * (t / length) ** 2, "low")
    y *= np.minimum(1, t / 0.05) * (0.5 + 0.5 * t / length)
    chord = sum(S.inst_bell(S.note_to_midi(nm), 0.5, 0.6, ratio=2.0, index=0.8, decay=0.7) for nm in ("D6", "F#6", "A6"))
    return _cat([(0, y * 0.35), (length - 0.02, chord * 0.6)])


def robot_beep():
    rng = np.random.default_rng(5)
    parts = []
    t0 = 0.0
    for k in range(6):
        d = rng.choice([0.05, 0.07, 0.1])
        f = rng.choice([880, 1046, 1318, 1568, 1760, 1174])
        n = S.nsamp(d)
        t = np.arange(n) / S.SR
        glide = 1 + (0.15 if k % 3 == 2 else 0) * t / d
        y = S.square(f * glide, 0.0, 0.25) * 0.4 + np.sin(2 * np.pi * f * glide * t) * 0.6
        y = S.lp(y, 4000)
        y *= np.minimum(1, t / 0.004) * np.minimum(1, (d - t) / 0.006)
        parts.append((t0, y))
        t0 += d + 0.02
    return _cat(parts) * 0.45


def whoosh():
    length = 0.6
    n = S.nsamp(length)
    t = np.arange(n) / S.SR
    cut = 300 + 4000 * np.sin(np.pi * t / length) ** 2
    y = S.sweep_filter(S.noise(n), cut, "low")
    y = S.hp(y, 150)
    y *= np.sin(np.pi * t / length) ** 2
    return y * 0.9


def unlock():
    parts = [(0, click()), (0.06, click() * 0.7)]
    for i, nm in enumerate(("G5", "C6", "E6", "G6")):
        parts.append((0.12 + i * 0.03, S.inst_bell(S.note_to_midi(nm), 0.3, 0.55, ratio=2.0, index=1.0, decay=0.9)))
    return _cat(parts)


def level_up():
    notes = ["C5", "E5", "G5", "C6", "E6", "G6", "C7"]
    parts = [(i * 0.07, S.inst_pluck(S.note_to_midi(nm), 0.15, 0.7, decay=0.25)) for i, nm in enumerate(notes)]
    chord = sum(S.inst_bell(S.note_to_midi(nm), 0.8, 0.5, ratio=2.0, index=1.0, decay=1.0) for nm in ("C6", "E6", "G6", "C7"))
    parts.append((0.5, chord * 0.7))
    n = S.nsamp(1.0)
    t = np.arange(n) / S.SR
    parts.append((0.45, S.hp(S.noise(n), 9000) * np.exp(-t / 0.3) * 0.1))
    return _cat(parts) * 1.1


def typing():
    n = S.nsamp(0.035)
    t = np.arange(n) / S.SR
    y = S.bp(S.noise(n), 2000, 7000) * np.exp(-t / 0.005)
    y += np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.004) * 0.3
    return y * 0.5


def crash_impact():
    """Uderzenie statku o ziemię (do sceny rozbicia). Głośne, ale zaokrąglone."""
    length = 2.8
    n = S.nsamp(length)
    t = np.arange(n) / S.SR
    boom = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t / 0.15)) / S.SR) * np.exp(-t / 0.7)
    rumble = S.lp(S.noise(n), 200) * np.exp(-t / 0.9) * 2.0
    crunch = S.bp(S.noise(n), 600, 4000) * np.exp(-t / 0.18) * 0.5
    debris = []
    rng = np.random.default_rng(4)
    for k in range(14):
        debris.append((0.25 + rng.uniform(0, 1.6), S.dr_clank(rng.uniform(0.3, 0.8)) * 0.7))
    y = np.tanh((boom + rumble + crunch) * 1.4) * 0.8
    return _cat([(0, y)] + debris)


def alarm():
    """Alarm statku (2 s, da się zapętlić)."""
    length = 2.0
    n = S.nsamp(length)
    t = np.arange(n) / S.SR
    fr = np.where((t % 1.0) < 0.5, 660, 880).astype(float)
    y = S.lp(S.square(fr, 0.0, 0.5) * 0.5 + S.saw(fr) * 0.3, 2500)
    gate = np.minimum(1, ((t % 0.5) / 0.01)) * np.minimum(1, (0.5 - (t % 0.5)) / 0.02)
    return y * gate * 0.35


def signal_space():
    """Sygnał z kosmosu: tajemnicze piknięcia z echem."""
    parts = []
    for i, (nm, tt) in enumerate((("A6", 0), ("E7", 0.18), ("A6", 0.36), ("C7", 0.9), ("B6", 1.08))):
        parts.append((tt, S.inst_bell(S.note_to_midi(nm), 0.2, 0.6, ratio=1.0, index=0.5, decay=0.25)))
    x = _cat(parts + [(2.5, np.zeros(10))])
    st = S.stereo(x)
    return st + S.echo(st, 0.27, 0.45, 6) * 0.7


SFX = {
    "click": click, "correct": correct, "wrong": wrong, "star": star,
    "part_attach": part_attach, "power_up": power_up, "robot_beep": robot_beep,
    "whoosh": whoosh, "unlock": unlock, "level_up": level_up, "typing": typing,
    "crash_impact": crash_impact, "alarm": alarm, "signal_space": signal_space,
}
