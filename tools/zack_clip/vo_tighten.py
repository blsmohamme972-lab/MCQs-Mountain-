"""Shorten pauses between words (Whisper timings) with short crossfades.
python vo_tighten.py in.wav words.txt out.wav max_gap_s"""
import sys
import numpy as np
import soundfile as sf

src, words, dst, max_gap = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
a, sr = sf.read(src)
a = a.mean(1) if a.ndim > 1 else a
w = [tuple(map(float, l.split()[:2])) for l in open(words) if l.strip()]
cuts = []
for (s0, e0), (s1, e1) in zip(w, w[1:]):
    gap = s1 - e0
    if gap > max_gap:
        mid = (e0 + s1) / 2
        cuts.append((mid - (gap - max_gap) / 2, mid + (gap - max_gap) / 2))
xf = int(sr * 0.012)
out, pos = [], 0
for c0, c1 in cuts:
    i0, i1 = int(c0 * sr), int(c1 * sr)
    seg = a[pos:i0].copy()
    if out:
        ramp = np.linspace(0, 1, xf)
        out[-1][-xf:] = out[-1][-xf:] * (1 - ramp) + seg[:xf] * ramp
        seg = seg[xf:]
    out.append(seg)
    pos = i1 - xf
tail = a[pos:]
ramp = np.linspace(0, 1, xf)
out[-1][-xf:] = out[-1][-xf:] * (1 - ramp) + tail[:xf] * ramp
out.append(tail[xf:])
res = np.concatenate(out)
sf.write(dst, res, sr)
print(f"{len(a) / sr:.2f}s -> {len(res) / sr:.2f}s, {len(cuts)} pauses shortened")
