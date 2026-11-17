"""Mały syntezator do generowania muzyki i efektów gry Roboguardian English Quest.

Wszystkie dźwięki powstają tutaj od zera (oscylatory, szum, filtry, pogłos),
bez próbek i bez cudzych nagrań, więc muzyka jest w pełni nasza.
"""
import numpy as np
from scipy import signal

SR = 44100
RNG = np.random.default_rng(7)


# ---------------------------------------------------------------- podstawy
NOTE_INDEX = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def note_to_midi(name):
    """'C#4', 'Bb3', 'D5' -> numer MIDI."""
    letter = name[0].upper()
    rest = name[1:]
    acc = 0
    while rest and rest[0] in "#b":
        acc += 1 if rest[0] == "#" else -1
        rest = rest[1:]
    octave = int(rest)
    return 12 * (octave + 1) + NOTE_INDEX[letter] + acc


def mtof(m):
    return 440.0 * 2 ** ((np.asarray(m, dtype=float) - 69) / 12)


def nsamp(sec):
    return max(1, int(round(sec * SR)))


def adsr(on_sec, a=0.01, d=0.1, s=0.8, r=0.2):
    """Obwiednia ADSR; długość = czas trzymania + wybrzmienie."""
    n_on = nsamp(on_sec)
    n_r = nsamp(r)
    env = np.empty(n_on + n_r)
    na = min(nsamp(a), n_on)
    env[:na] = np.linspace(0, 1, na, endpoint=False) if na > 0 else []
    rest = n_on - na
    if rest > 0:
        t = np.arange(rest) / SR
        env[na:n_on] = s + (1 - s) * np.exp(-t / max(d, 1e-4))
    last = env[n_on - 1] if n_on > 0 else 0
    t = np.arange(n_r) / SR
    env[n_on:] = last * np.exp(-t / (r / 5 + 1e-5))
    # łagodny koniec, żeby nie trzaskało
    tail = min(256, len(env))
    env[-tail:] *= np.linspace(1, 0, tail)
    return env


def perc_env(sec, decay, attack=0.002):
    n = nsamp(sec)
    t = np.arange(n) / SR
    env = np.exp(-t / decay)
    na = nsamp(attack)
    env[:na] *= np.linspace(0, 1, na)
    tail = min(256, n)
    env[-tail:] *= np.linspace(1, 0, tail)
    return env


def _polyblep(ph, dt):
    out = np.zeros_like(ph)
    m = ph < dt
    x = ph[m] / dt[m]
    out[m] = 2 * x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    out[m] = x * x + 2 * x + 1
    return out


def phase_from_freq(freq, phase0=0.0):
    return (phase0 + np.cumsum(freq) / SR) % 1.0


def saw(freq, phase0=None):
    freq = np.asarray(freq, dtype=float)
    if phase0 is None:
        phase0 = RNG.random()
    ph = phase_from_freq(freq, phase0)
    dt = np.clip(freq / SR, 1e-6, 0.5)
    return 2 * ph - 1 - _polyblep(ph, dt)


def square(freq, phase0=None, width=0.5):
    freq = np.asarray(freq, dtype=float)
    if phase0 is None:
        phase0 = RNG.random()
    ph = phase_from_freq(freq, phase0)
    dt = np.clip(freq / SR, 1e-6, 0.5)
    s1 = 2 * ph - 1 - _polyblep(ph, dt)
    ph2 = (ph + width) % 1.0
    s2 = 2 * ph2 - 1 - _polyblep(ph2, dt)
    return 0.5 * (s1 - s2)


def sine(freq, phase0=0.0):
    freq = np.asarray(freq, dtype=float)
    return np.sin(2 * np.pi * phase_from_freq(freq, phase0))


def noise(n):
    return RNG.uniform(-1, 1, n)


def lp(x, cutoff, order=2):
    cutoff = min(cutoff, SR * 0.45)
    sos = signal.butter(order, cutoff, "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def hp(x, cutoff, order=2):
    sos = signal.butter(order, cutoff, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def bp(x, lo, hi, order=2):
    hi = min(hi, SR * 0.45)
    sos = signal.butter(order, [lo, hi], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def sweep_filter(x, cutoffs, kind="low", block=256, q_order=2):
    """Filtr z ruchomą częstotliwością (przetwarzanie blokami)."""
    out = np.zeros_like(x)
    zi = None
    n = len(x)
    for i in range(0, n, block):
        c = float(np.clip(cutoffs[min(i, len(cutoffs) - 1)], 30, SR * 0.45))
        sos = signal.butter(q_order, c, kind, fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return out


def vibrato(n, rate=5.0, depth_semi=0.12, delay=0.25):
    t = np.arange(n) / SR
    ramp = np.clip((t - delay) / 0.4, 0, 1)
    return 2 ** (depth_semi * ramp * np.sin(2 * np.pi * rate * t) / 12)


def stereo(mono, pan=0.0, width=0.0):
    """Mono -> stereo z panoramą (-1..1)."""
    ang = (pan + 1) * np.pi / 4
    return np.vstack([mono * np.cos(ang), mono * np.sin(ang)]) * np.sqrt(2)


# ---------------------------------------------------------------- instrumenty
# Każdy instrument: f(midi, dur_sec, vel) -> tablica (2, n)

def inst_pad(m, dur, vel=0.8, bright=1.0):
    f = mtof(m)
    n = nsamp(dur + 1.4)
    env = adsr(dur, a=0.7, d=0.8, s=0.85, r=1.4)[:n]
    n = len(env)
    detunes = [-14, -6, 0, 7, 13]
    lfo = 1 + 0.002 * np.sin(2 * np.pi * 0.3 * np.arange(n) / SR)
    vs = [saw(np.full(n, f * 2 ** (c / 1200)) * lfo) for c in detunes]
    L = vs[0] + 0.7 * vs[2] + vs[3]
    R = vs[1] + 0.7 * vs[2] + vs[4]
    cut = min(900 + f * 2.5, 4000) * bright
    L = lp(L, cut)
    R = lp(R, cut)
    return np.vstack([L, R]) * env * vel * 0.12


def inst_choir(m, dur, vel=0.8):
    """Miękki chór 'ooh' z filtrów formantowych."""
    f = mtof(m)
    n = nsamp(dur + 1.2)
    env = adsr(dur, a=0.5, d=0.5, s=0.9, r=1.2)[:n]
    n = len(env)
    vib = vibrato(n, 4.6, 0.10, 0.3)
    out = []
    for c in (-8, 8):
        src = saw(f * 2 ** (c / 1200) * vib) + 0.3 * noise(n) * 0.2
        v = (bp(src, 250, 450) * 1.0 + bp(src, 700, 1000) * 0.45 +
             bp(src, 2200, 2600) * 0.12)
        out.append(v)
    return np.vstack(out) * env * vel * 0.35


def inst_strings(m, dur, vel=0.8, attack=0.12):
    f = mtof(m)
    n = nsamp(dur + 0.6)
    env = adsr(dur, a=attack, d=0.3, s=0.9, r=0.6)[:n]
    n = len(env)
    vib = vibrato(n, 5.2, 0.14, 0.2)
    L = saw(f * vib * 2 ** (-6 / 1200)) + saw(f * vib * 2 ** (4 / 1200))
    R = saw(f * vib * 2 ** (6 / 1200)) + saw(f * vib * 2 ** (-3 / 1200))
    cut = min(1800 + f * 3, 6000)
    L = lp(lp(L, cut), 7000, 1)
    R = lp(lp(R, cut), 7000, 1)
    return np.vstack([L, R]) * env * vel * 0.13


def inst_short_strings(m, dur, vel=0.8):
    f = mtof(m)
    n = nsamp(min(dur, 0.25) + 0.15)
    env = adsr(min(dur * 0.6, 0.18), a=0.008, d=0.06, s=0.5, r=0.12)[:n]
    n = len(env)
    x = saw(np.full(n, f * 0.998)) + saw(np.full(n, f * 1.003))
    x = lp(x, min(1500 + f * 4, 6000))
    return stereo(x * env * vel * 0.16)


def inst_brass(m, dur, vel=0.8):
    f = mtof(m)
    n = nsamp(dur + 0.25)
    env = adsr(dur, a=0.035, d=0.25, s=0.75, r=0.25)[:n]
    n = len(env)
    vib = vibrato(n, 5.0, 0.08, 0.35)
    x = saw(f * vib * 0.997) + saw(f * vib * 1.003) + 0.5 * square(f * vib * 0.5)
    dark = lp(x, 500 + f * 0.8)
    bright = lp(x, min(2400 + f * 3, 8000))
    t = np.arange(n) / SR
    fe = 0.35 + 0.65 * np.exp(-t / 0.25)
    fe *= 0.6 + 0.4 * vel
    y = dark * (1 - fe) + bright * fe
    return stereo(y * env * vel * 0.16, 0.0)


def inst_pluck(m, dur, vel=0.8, decay=0.35, bright=1.0):
    f = mtof(m)
    length = min(dur, 2.0) + decay * 2
    n = nsamp(length)
    t = np.arange(n) / SR
    x = 0.6 * saw(np.full(n, f)) + 0.4 * square(np.full(n, f * 1.002), width=0.3)
    dark = lp(x, 400 + f)
    brt = lp(x, min(5000 * bright + f * 2, 12000))
    fe = np.exp(-t / (decay * 0.35))
    y = dark * (1 - fe) + brt * fe
    env = perc_env(length, decay)
    return y * env * vel * 0.22


def inst_bell(m, dur, vel=0.8, ratio=3.5, index=2.5, decay=1.6):
    f = mtof(m)
    length = decay * 3
    n = nsamp(length)
    t = np.arange(n) / SR
    idx = index * np.exp(-t / (decay * 0.4))
    mod = np.sin(2 * np.pi * f * ratio * t) * idx
    car = np.sin(2 * np.pi * f * t + mod)
    car += 0.25 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / (decay * 0.3))
    env = perc_env(length, decay)
    return car * env * vel * 0.18


def inst_glock(m, dur, vel=0.8):
    return inst_bell(m, dur, vel, ratio=4.0, index=1.2, decay=0.9)


def inst_epiano(m, dur, vel=0.8):
    f = mtof(m)
    length = min(dur, 3.0) + 0.6
    n = nsamp(length)
    t = np.arange(n) / SR
    idx = (0.6 + 1.6 * vel) * np.exp(-t / 0.35)
    mod = np.sin(2 * np.pi * f * t) * idx
    body = np.sin(2 * np.pi * f * t + mod)
    tine = 0.18 * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t / 0.03)
    env = adsr(min(dur, 3.0), a=0.003, d=1.2, s=0.25, r=0.5)[:n]
    env = env * np.exp(-t[:len(env)] / 3.5)
    y = (body + tine)[:len(env)] * env
    return y * vel * 0.28


def inst_marimba(m, dur, vel=0.8):
    f = mtof(m)
    length = 0.9
    n = nsamp(length)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.35)
    y += 0.35 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t / 0.05)
    y += 0.15 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.015)
    y *= perc_env(length, 1.0, 0.001)
    return y * vel * 0.32


def inst_flute(m, dur, vel=0.8):
    f = mtof(m)
    n = nsamp(dur + 0.3)
    env = adsr(dur, a=0.08, d=0.2, s=0.85, r=0.3)[:n]
    n = len(env)
    vib = vibrato(n, 5.0, 0.18, 0.3)
    y = sine(f * vib) + 0.25 * sine(2 * f * vib) + 0.08 * sine(3 * f * vib)
    breath = bp(noise(n), f * 0.8, min(f * 3, 15000)) * 0.12
    return (y + breath) * env * vel * 0.2


def inst_lead(m, dur, vel=0.8):
    f = mtof(m)
    n = nsamp(dur + 0.2)
    env = adsr(dur, a=0.01, d=0.15, s=0.7, r=0.15)[:n]
    n = len(env)
    vib = vibrato(n, 5.5, 0.1, 0.25)
    y = square(f * vib, width=0.35) + 0.4 * saw(f * vib * 1.004)
    y = lp(y, min(2500 + f, 7000))
    return y * env * vel * 0.12


def inst_bass(m, dur, vel=0.8, cutoff=700):
    f = mtof(m)
    n = nsamp(dur + 0.12)
    env = adsr(dur, a=0.006, d=0.2, s=0.75, r=0.1)[:n]
    n = len(env)
    t = np.arange(n) / SR
    x = saw(np.full(n, f)) * 0.6 + sine(np.full(n, f)) * 0.9
    fe = np.exp(-t / 0.12)
    y = lp(x, cutoff) * (1 - fe * 0.5) + lp(x, cutoff * 2.5) * fe * 0.5
    return y * env * vel * 0.38


def inst_subbass(m, dur, vel=0.8):
    f = mtof(m)
    n = nsamp(dur + 0.4)
    env = adsr(dur, a=0.05, d=0.4, s=0.9, r=0.4)[:n]
    n = len(env)
    y = sine(np.full(n, f)) + 0.15 * sine(np.full(n, 2 * f))
    return y * env * vel * 0.35


def inst_timpani(m, dur, vel=0.8):
    f = mtof(m)
    length = 2.2
    n = nsamp(length)
    t = np.arange(n) / SR
    fr = f * (1 + 0.06 * np.exp(-t / 0.05))
    y = sine(fr) + 0.5 * sine(fr * 1.5) * np.exp(-t / 0.4) + 0.3 * sine(fr * 1.98) * np.exp(-t / 0.3)
    y += lp(noise(n), 400) * np.exp(-t / 0.04) * 0.8
    y *= perc_env(length, 0.7)
    return y * vel * 0.5


# ---------------------------------------------------------------- perkusja
def dr_kick(vel=0.8, tight=1.0):
    length = 0.45
    n = nsamp(length)
    t = np.arange(n) / SR
    fr = 45 + 110 * np.exp(-t / (0.03 * tight))
    y = sine(fr) * np.exp(-t / (0.22 * tight))
    y += lp(noise(n), 3000) * np.exp(-t / 0.004) * 0.4
    y = np.tanh(y * 1.5)
    return y * perc_env(length, 1.0, 0.0005) * vel * 0.75


def dr_snare(vel=0.8):
    length = 0.35
    n = nsamp(length)
    t = np.arange(n) / SR
    tone = sine(185 * (1 + 0.3 * np.exp(-t / 0.01))) * np.exp(-t / 0.06)
    nz = bp(noise(n), 1200, 9000) * np.exp(-t / 0.12)
    y = 0.6 * tone + 0.8 * nz
    return y * perc_env(length, 1.0, 0.0005) * vel * 0.45


def dr_clap(vel=0.8):
    length = 0.4
    n = nsamp(length)
    t = np.arange(n) / SR
    env = np.zeros(n)
    for off in (0.0, 0.011, 0.022):
        k = nsamp(off)
        env[k:] += np.exp(-(t[: n - k]) / 0.012)
    env += 0.6 * np.exp(-t / 0.15)
    y = bp(noise(n), 900, 4000) * env
    return y * vel * 0.3


def dr_hat(vel=0.8, open_=False):
    length = 0.4 if open_ else 0.08
    n = nsamp(length)
    t = np.arange(n) / SR
    metal = sum(square(np.full(n, fr), 0.0) for fr in (317, 465, 551, 683, 821, 1003))
    y = hp(metal * 0.3 + noise(n) * 0.7, 7000)
    y *= np.exp(-t / (0.15 if open_ else 0.025))
    return y * vel * 0.22


def dr_shaker(vel=0.8):
    length = 0.12
    n = nsamp(length)
    t = np.arange(n) / SR
    env = (t / 0.03) * np.exp(1 - t / 0.03)
    y = bp(noise(n), 5000, 12000) * env
    return y * vel * 0.12


def dr_tom(m, vel=0.8):
    f = mtof(m)
    length = 0.6
    n = nsamp(length)
    t = np.arange(n) / SR
    fr = f * (1 + 0.5 * np.exp(-t / 0.04))
    y = sine(fr) * np.exp(-t / 0.25) + lp(noise(n), 2000) * np.exp(-t / 0.02) * 0.4
    return np.tanh(y * 1.3) * perc_env(length, 1.0, 0.0005) * vel * 0.5


def dr_taiko(vel=0.8):
    length = 1.2
    n = nsamp(length)
    t = np.arange(n) / SR
    fr = 70 * (1 + 0.6 * np.exp(-t / 0.03))
    y = sine(fr) * np.exp(-t / 0.35) + lp(noise(n), 900) * np.exp(-t / 0.05) * 0.7
    return np.tanh(y * 1.6) * perc_env(length, 1.0, 0.0005) * vel * 0.6


def dr_crash(vel=0.8, length=2.5):
    n = nsamp(length)
    t = np.arange(n) / SR
    metal = sum(square(np.full(n, fr), RNG.random()) for fr in (293, 371, 467, 587, 739, 931, 1171))
    y = hp(metal * 0.25 + noise(n), 4000)
    y *= np.exp(-t / (length * 0.3))
    y *= np.minimum(1, t / 0.002 + 0.01)
    return y * vel * 0.18


def dr_rim(vel=0.8):
    length = 0.08
    n = nsamp(length)
    t = np.arange(n) / SR
    y = sine(np.full(n, 1700)) * np.exp(-t / 0.008) + bp(noise(n), 2000, 6000) * np.exp(-t / 0.006)
    return y * vel * 0.25


def dr_clank(vel=0.8):
    """Metaliczny stuk (warsztat / hangar)."""
    length = 0.5
    n = nsamp(length)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for fr, a, d in ((523, 1, 0.12), (1187, 0.6, 0.09), (1871, 0.5, 0.06), (2941, 0.3, 0.04)):
        y += a * np.sin(2 * np.pi * fr * t) * np.exp(-t / d)
    y += hp(noise(n), 3000) * np.exp(-t / 0.01) * 0.6
    return y * vel * 0.15


def riser(length, f0=300, f1=6000, vel=0.6):
    n = nsamp(length)
    t = np.arange(n) / SR
    cuts = f0 * (f1 / f0) ** (t / length)
    y = sweep_filter(noise(n), cuts, "low")
    y = hp(y, 150)
    env = (t / length) ** 2
    tail = min(512, n)
    env[-tail:] *= np.linspace(1, 0, tail)
    return y * env * vel * 0.5


# ---------------------------------------------------------------- efekty
def make_reverb_ir(length=2.6, decay=0.6, lowcut=6000, predelay=0.012, seed=3):
    rng = np.random.default_rng(seed)
    n = nsamp(length)
    t = np.arange(n) / SR
    out = []
    for ch in range(2):
        x = rng.standard_normal(n) * np.exp(-t / decay)
        # ciemniejszy ogon
        x = lp(x, lowcut, 1)
        x[: nsamp(predelay)] = 0
        # wczesne odbicia
        for k, (dt, g) in enumerate(((0.017, 0.5), (0.023, 0.4), (0.031, 0.35), (0.041, 0.3), (0.053, 0.25))):
            i = nsamp(dt + 0.003 * ch * (k % 2))
            x[i] += g * 6
        out.append(x)
    ir = np.vstack(out)
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir


def reverb(x, ir, wet=1.0):
    out = np.vstack([signal.oaconvolve(x[0], ir[0])[: x.shape[1]],
                     signal.oaconvolve(x[1], ir[1])[: x.shape[1]]])
    return out * wet


def echo(x, delay_sec, feedback=0.35, repeats=5, pingpong=True):
    d = nsamp(delay_sec)
    out = x.copy()
    g = 1.0
    for k in range(1, repeats + 1):
        g *= feedback
        sh = d * k
        if sh >= x.shape[1]:
            break
        src = x[:, : x.shape[1] - sh] * g
        src = np.vstack([lp(src[0], 4000, 1), lp(src[1], 4000, 1)])
        if pingpong and k % 2 == 1:
            src = src[::-1]
        out[:, sh:] += src
    return out - x  # tylko sygnał efektu


def soft_limit(x, ceiling=0.93):
    return np.tanh(x / ceiling) * ceiling
