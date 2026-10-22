"""Word timings of a wav: python listen.py file.wav"""
import sys
sys.path.insert(0, "/home/user/MCQs-Mountain-/voiceover")
from voiceover import pcm16k  # noqa: E402
from faster_whisper import WhisperModel  # noqa: E402
m = WhisperModel("base.en", device="cpu", compute_type="int8")
segs, _ = m.transcribe(pcm16k(sys.argv[1]), beam_size=5, temperature=0.0, word_timestamps=True)
for s in segs:
    for w in s.words:
        print(f"{w.start:6.2f} {w.end:6.2f} {w.word}")
