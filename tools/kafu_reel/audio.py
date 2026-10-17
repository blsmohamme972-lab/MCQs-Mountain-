"""The reel's sound: the lesson voice (from the package), a 120 bpm music bed and UI effects, mixed to -14 LUFS.

Everything is synthesised here from the plan's cue times, so the sound always lands on the picture.
"""
from __future__ import annotations
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 48000
BEAT = 0.5          # 120 bpm


def _decode(data: bytes) -> np.ndarray:
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", "-", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], input=data,
                       capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float32).copy()


def _tempo(x: np.ndarray, rate: float) -> np.ndarray:
    if abs(rate - 1) < 1e-6:
        return x
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", f"atempo={rate}",
                        "-f", "f32le", "-"], input=x.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float32).copy()


R = np.random.default_rng(20261017)


def _put(buf, x, t, g=1.0):
    i = int(round(t * SR))
    if i < 0:
        x = x[-i:]; i = 0
    n = min(len(x), len(buf) - i)
    if n > 0:
        buf[i:i + n] += g * x[:n]


def _env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def _lp(x, k):
    c = np.cumsum(np.concatenate([np.zeros(k), x]))
    return np.roll((c[k:] - c[:-k]) / k, -(k // 2))


def _hp(x, k):
    return x - _lp(x, k)


def _noise(n):
    return R.standard_normal(n).astype(np.float32)


def kick(f0=120, f1=44, dur=0.42, click=0.25):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 30)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.001, 0.16)
    cl = _hp(_noise(n), 3) * _env(n, 0.0002, 0.004) * click
    return body + cl


def clap():
    n = int(0.25 * SR); x = _hp(_lp(_noise(n), 3), 30)
    e = np.zeros(n)
    for k, d in ((0, .010), (0.011, .010), (0.022, .14)):
        i = int(k * SR); e[i:] += _env(n - i, 0.0005, d)
    return x * e * 0.5


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    return _hp(_noise(n), 2) * _env(n, 0.0005, 0.06 if open_ else 0.012) * 0.35


def tone(f, dur, a=0.002, d=0.25, harm=((1, 1),)):
    n = int(dur * SR); t = np.arange(n) / SR
    return sum(w * np.sin(2 * np.pi * f * h * t) for h, w in harm) * _env(n, a, d)


def whoosh(dur=0.6, up=True, g=1.0):
    n = int(dur * SR); x = _noise(n); p = np.linspace(0, 1, n) if up else np.linspace(1, 0, n)
    y = _lp(x, 48) * (1 - p) + _lp(x, 5) * p
    return y * np.sin(np.pi * np.linspace(0, 1, n)) ** 2 * 0.9 * g


def riser(dur):
    n = int(dur * SR); x = _noise(n); p = np.linspace(0, 1, n)
    return (_lp(x, 30) * (1 - p) + _hp(x, 4) * p) * p ** 2 * 0.7


def tap():
    n = int(0.06 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1900 * t) * 0.5 + _hp(_noise(n), 3) * 0.6) * _env(n, 0.0003, 0.008)


def pop(f=700):
    n = int(0.12 * SR); t = np.arange(n) / SR; fr = f * 0.7 + f * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * _env(n, 0.002, 0.035) * 0.6


def chime(notes, step=0.07, d=0.6):
    o = np.zeros(int((step * len(notes) + d * 2.5) * SR))
    for i, f in enumerate(notes):
        _put(o, tone(f, d * 2.5, 0.003, d, ((1, 1), (2, .22), (3, .07))), i * step)
    return o * 0.4


def sparkle():
    o = np.zeros(int(0.4 * SR))
    for i, f in enumerate((2093, 2637, 3136)):
        _put(o, tone(f, 0.3, 0.001, 0.06), i * 0.035)
    return o * 0.18


CHORDS = [(57, 60, 64), (53, 57, 60), (48, 55, 60), (55, 59, 62)]      # Am F C G (midi)
ROOTS = [45, 41, 48, 43]
mf = lambda m: 440 * 2 ** ((m - 69) / 12)


def music(T: float, groove: list[tuple[float, float]], pad_on: list[tuple[float, float]]) -> np.ndarray:
    """120 bpm bed. `groove` spans get drums + bass; `pad_on` spans get the soft chord pad."""
    N = int((T + 1) * SR); out = np.zeros(N, np.float32); duck = np.ones(N, np.float32)
    nbeats = int(T / BEAT) + 1
    for b in range(nbeats):
        t = 0.05 + b * BEAT
        if not any(a <= t < z for a, z in groove):
            continue
        bar, beat = divmod(b, 4)
        _put(out, kick(), t, 0.9)
        i = int(t * SR); m = min(int(0.22 * SR), N - i)
        duck[i:i + m] = np.minimum(duck[i:i + m], 0.35 + 0.65 * np.linspace(0, 1, m) ** 1.5)
        if beat in (1, 3):
            _put(out, clap(), t, 0.7)
        _put(out, hat(), t + BEAT / 2, 0.8)
        if beat == 3:
            _put(out, hat(True), t + BEAT * 0.75, 0.35)
        root = mf(ROOTS[bar % 4] - 12 + 12)
        for k in (0, 1):
            tt = t + k * BEAT / 2
            n = int(0.22 * SR); x = np.arange(n) / SR
            bass = (np.sin(2 * np.pi * root * x) + 0.35 * np.sin(2 * np.pi * root * 2 * x) + 0.12 * np.sin(2 * np.pi * root * 3 * x)) * _env(n, 0.004, 0.12)
            _put(out, bass.astype(np.float32), tt, 0.32)
    pad = np.zeros(N, np.float32)
    for bar in range(int(T / (4 * BEAT)) + 1):
        t = 0.05 + bar * 4 * BEAT
        if not any(a <= t < z for a, z in pad_on):
            continue
        n = int(2.6 * SR); x = np.arange(n) / SR
        e = np.minimum(1, x / 0.35) * np.minimum(1, np.maximum(0, (2.6 - x) / 0.8))
        s = sum(np.sin(2 * np.pi * mf(m) * x) + 0.4 * np.sin(2 * np.pi * mf(m) * 1.004 * x) + 0.12 * np.sin(2 * np.pi * mf(m + 12) * x) for m in CHORDS[bar % 4])
        _put(pad, (s * e).astype(np.float32), t, 0.05)
    pad = _lp(pad, 10)
    return out * duck * 0.55 + pad * duck


def mix(voice_bytes: bytes, cues: dict, cfg: dict, out: Path) -> Path:
    T = cues["T"]; N = int((T + 1) * SR)
    rate = float(cfg.get("rate", 1.1))
    L0, L1 = cues["lesson"]
    voice = np.zeros(N, np.float32)
    v = _tempo(_decode(voice_bytes), rate)
    _put(voice, v, L0)
    sfx = np.zeros(N, np.float32)
    _put(sfx, kick(100, 30, 1.1, 0.6), cues["boom"], 1.4); _put(sfx, tone(46, 1.6, 0.002, 0.7) * 0.8, cues["boom"])
    _put(sfx, whoosh(0.7, False, 0.8), cues["boom"] - 0.02)
    _put(sfx, riser(0.55), cues["phone_in"] - 0.5, 0.6); _put(sfx, whoosh(0.75, True, 0.9), cues["phone_in"])
    _put(sfx, kick(90, 40, 0.3, 0.1), cues["land"], 0.5)
    for t in cues["texts"]:
        _put(sfx, pop(620), t, 0.28)
    for t in cues["swipes"]:
        _put(sfx, whoosh(0.35, True, 0.45), t)
    for t in cues["whips"]:
        _put(sfx, whoosh(0.5, True, 0.9), t - 0.05)
    for t in cues["taps"]:
        _put(sfx, tap(), t, 0.9)
    for t in cues["highlights"]:
        _put(sfx, sparkle(), t, 0.8)
    _put(sfx, pop(880), cues["play"], 0.45)
    _put(sfx, whoosh(0.6, True, 0.6), cues["end"] - 0.1); _put(sfx, chime([523.3, 659.3, 784.0, 1046.5], 0.09, 0.7), cues["end"] + 0.15, 0.9)
    bed = music(T, groove=[(0.0, L0 - 0.2), (cues["end"], T)], pad_on=[(0.0, T)])
    # duck the bed under the voice
    env = _lp(np.abs(voice), 4800); env /= env.max() + 1e-9
    bed *= 1 - 0.78 * np.clip(env * 4, 0, 1)
    bed[int(L0 * SR):int(L1 * SR)] *= 0.55
    m = voice * 1.0 + sfx * 0.55 + bed * 0.9
    m = m[:int(T * SR)]
    fe = int(0.5 * SR); m[-fe:] *= np.linspace(1, 0, fe)
    m /= max(1e-9, float(np.abs(m).max())) / 0.9
    wav = out / "mix.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(m, -1, 1) * 32767).astype(np.int16).tobytes())
    # two-pass loudness normalisation to -14 LUFS, true peak -1.5 dBTP
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    st = json.loads(p.stderr[p.stderr.rfind("{"):p.stderr.rfind("}") + 1])
    flt = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={st['input_i']}:measured_TP={st['input_tp']}:measured_LRA={st['input_lra']}:"
           f"measured_thresh={st['input_thresh']}:offset={st['target_offset']}:linear=true")
    m4a = out / "mix.m4a"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-af", flt, "-ar", str(SR), "-ac", "2", "-c:a", "aac", "-b:a", "192k",
                    str(m4a)], check=True)
    return m4a
