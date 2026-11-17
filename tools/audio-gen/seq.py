"""Sekwencer: zapis nut, akordów i rytmów oraz renderowanie utworu (także pętli bez przerwy)."""
import numpy as np
import synth as S

ROOTS = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6,
         "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
QUAL = {"": [0, 4, 7], "m": [0, 3, 7], "7": [0, 4, 7, 10], "maj7": [0, 4, 7, 11],
        "m7": [0, 3, 7, 10], "sus4": [0, 5, 7], "sus2": [0, 2, 7], "add9": [0, 4, 7, 14],
        "madd9": [0, 3, 7, 14], "6": [0, 4, 7, 9], "dim": [0, 3, 6], "5": [0, 7]}


def parse_chord(name):
    """'Dm', 'Bbmaj7', 'D/F#' -> (root_pc, [interwały], bass_pc)."""
    bass = None
    if "/" in name:
        name, b = name.split("/")
        bass = ROOTS[b]
    r = name[:2] if len(name) > 1 and name[1] in "#b" else name[:1]
    q = name[len(r):]
    root = ROOTS[r]
    return root, QUAL[q], (bass if bass is not None else root)


def voice(name, lo=55, span=12, top=False):
    """Akord w zakresie [lo, lo+span) w układzie skupionym."""
    root, ints, _ = parse_chord(name)
    notes = []
    for i in ints:
        pc = (root + i) % 12
        m = lo + ((pc - lo) % 12)
        notes.append(m)
    return sorted(set(notes))


def bass_note(name, octave_lo=36):
    _, _, b = parse_chord(name)
    return octave_lo + ((b - octave_lo) % 12)


def chord_tones(name, base=60, n=4):
    """Kolejne dźwięki akordu w górę od base (do arpeggio)."""
    root, ints, _ = parse_chord(name)
    pcs = [(root + i) % 12 for i in ints if i < 12]
    out = []
    m = base
    while len(out) < n:
        if m % 12 in pcs:
            out.append(m)
        m += 1
    return out


def mel(text, start=0.0):
    """'D5:1.5 A4:.5 D5 E5 | r:2 ...' -> [(beat, dur, midi)]."""
    out = []
    b = start
    for tok in text.replace("|", " ").split():
        if ":" in tok:
            nm, d = tok.split(":")
            d = float(d)
        else:
            nm, d = tok, 1.0
        if nm != "r":
            out.append((b, d, S.note_to_midi(nm)))
        b += d
    return out


class Song:
    def __init__(self, bpm, bars, beats_per_bar=4, seed=1):
        self.bpm = bpm
        self.bars = bars
        self.bpb = beats_per_bar
        self.tracks = {}
        self.rng = np.random.default_rng(seed)

    @property
    def beat(self):
        return 60.0 / self.bpm

    @property
    def length_beats(self):
        return self.bars * self.bpb

    @property
    def length_sec(self):
        return self.length_beats * self.beat

    def track(self, name, gain=1.0, pan=0.0, reverb=0.2, delay=0.0, delay_beats=0.75):
        if name not in self.tracks:
            self.tracks[name] = dict(events=[], gain=gain, pan=pan, reverb=reverb,
                                     delay=delay, delay_beats=delay_beats)
        return self.tracks[name]

    def note(self, track, inst, beat, dur, midi, vel=0.8, human=True, **kw):
        jit = self.rng.normal(0, 0.004) if human else 0.0
        v = vel * (1 + self.rng.normal(0, 0.04)) if human else vel
        self.tracks[track]["events"].append((beat * self.beat + jit, inst, dur * self.beat, midi, v, kw))

    def hit(self, track, fn, beat, vel=0.8, human=True, **kw):
        jit = self.rng.normal(0, 0.003) if human else 0.0
        v = vel * (1 + self.rng.normal(0, 0.06)) if human else vel
        self.tracks[track]["events"].append((beat * self.beat + jit, fn, None, None, v, kw))

    def melody(self, track, inst, notes, offset=0.0, vel=0.8, legato=1.0, transpose=0):
        for b, d, m in notes:
            self.note(track, inst, b + offset, d * legato, m + transpose, vel)

    def chords(self, track, inst, prog, start_bar=0, bars_each=1, lo=55, vel=0.7, span=None, dur_scale=1.0):
        for i, ch in enumerate(prog):
            b = (start_bar + i * bars_each) * self.bpb
            d = bars_each * self.bpb * dur_scale
            for m in voice(ch, lo):
                self.note(track, inst, b, d, m, vel)

    def pattern(self, track, fn, pat, start_bar, bars, vel=0.8, steps_per_beat=4, **kw):
        """pat: 'x...o...X...' na jeden takt (lub dłuższy). X mocno, x normalnie, o cicho."""
        steps = len(pat)
        step_beats = 1.0 / steps_per_beat
        pat_beats = steps * step_beats
        reps = int(round(bars * self.bpb / pat_beats))
        for r in range(reps):
            for i, c in enumerate(pat):
                if c in "xXo":
                    v = vel * {"X": 1.15, "x": 1.0, "o": 0.5}[c]
                    self.hit(track, fn, start_bar * self.bpb + r * pat_beats + i * step_beats, v, **kw)

    # ------------------------------------------------------------ render
    def _render_events(self, total_sec, offsets):
        n_total = S.nsamp(total_sec)
        buses = {}
        for name, tr in self.tracks.items():
            dry = np.zeros((2, n_total))
            for (t, fn, dur, midi, vel, kw) in tr["events"]:
                if midi is None:
                    y = fn(vel=vel, **kw)
                else:
                    y = fn(midi, dur, vel, **kw)
                if y.ndim == 1:
                    y = S.stereo(y, tr["pan"])
                elif tr["pan"]:
                    ang = (tr["pan"] + 1) * np.pi / 4
                    y = y * np.array([[np.cos(ang)], [np.sin(ang)]]) * np.sqrt(2)
                ts = int(round(t * S.SR))
                for off in offsets:
                    i0 = max(0, ts + off)
                    if i0 >= n_total:
                        continue
                    seg = y[:, : n_total - i0]
                    dry[:, i0: i0 + seg.shape[1]] += seg
            buses[name] = dry * tr["gain"]
        return buses

    def render(self, loop=True, pre=0.5, post=1.5, tail=3.0, reverb_ir=None, master_gain=1.0):
        """Zwraca (audio[2,n], loopStart, loopEnd). Dla pętli plik jest okresowy na [loopStart, loopEnd+post]."""
        Ls = S.nsamp(self.length_sec)
        L = Ls / S.SR
        ir = reverb_ir if reverb_ir is not None else S.make_reverb_ir()
        if loop:
            offsets = [0, Ls, 2 * Ls]
            total = 3 * L + tail
        else:
            offsets = [0]
            total = L + tail
        buses = self._render_events(total, offsets)
        mix = np.zeros((2, S.nsamp(total)))
        rev_send = np.zeros_like(mix)
        for name, tr in self.tracks.items():
            x = buses[name]
            mix += x
            rev_send += x * tr["reverb"]
            if tr["delay"] > 0:
                mix += S.echo(x, tr["delay_beats"] * self.beat) * tr["delay"]
        mix += S.reverb(rev_send, ir)
        mix *= master_gain
        if loop:
            ps = S.nsamp(pre)
            a = Ls - ps
            b = 2 * Ls + S.nsamp(post)
            out = mix[:, a:b]
            return out, ps / S.SR, (ps + Ls) / S.SR
        # przytnij ciszę na końcu
        energy = np.max(np.abs(mix), axis=0)
        idx = np.nonzero(energy > 1e-4)[0]
        end = idx[-1] + 1 if len(idx) else mix.shape[1]
        out = mix[:, :end]
        fade = min(S.nsamp(0.05), out.shape[1])
        out[:, -fade:] *= np.linspace(1, 0, fade)
        return out, 0.0, out.shape[1] / S.SR
