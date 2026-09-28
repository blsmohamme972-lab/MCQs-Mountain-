"""Raster tolerance allows measured browser noise without hiding visual changes."""
import hashlib
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from tools.ui.check import NOISY_CAPTURES, tiny_raster_noise


class VisualToleranceTests(unittest.TestCase):
    def test_only_measured_noise_passes(self):
        # A synthetic image proves tiny noise survives and a real visual change
        # is rejected. The reviewed CI variants are checked below when present.
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'candidate.png'
            image = Image.new('RGBA', (820, 1180), (72, 112, 144, 255))
            reduced=image.convert('RGB').resize((103,148),Image.Resampling.BOX)
            known=('synthetic-baseline',hashlib.sha256(bytes(value//8 for value in reduced.tobytes())).hexdigest())
            name='ipad-dark-study-correct'
            original=NOISY_CAPTURES[name]
            NOISY_CAPTURES[name]=known
            try:
                expected={'sha256':known[0],'width':820,'height':1180}
                image.putpixel((20,20),(73,112,144,255))
                image.save(target)
                self.assertTrue(tiny_raster_noise(name,target,expected))
                self.assertFalse(tiny_raster_noise('phone-light-home',target,expected))
                image.paste((255,0,0,255),(30,30,200,200))
                image.save(target)
                self.assertFalse(tiny_raster_noise(name,target,expected))
                self.assertFalse(tiny_raster_noise(name,target,{**expected,'sha256':'other'}))
            finally:
                NOISY_CAPTURES[name]=original

    def test_real_ci_variants_if_present(self):
        second = Path('/tmp/kafu-ui-evidence-2/after')
        if not second.exists():
            self.skipTest('local CI screenshot artifact unavailable')
        for name in ('ipad-dark-study-correct', 'ipad-light-library-no-results'):
            raw, _ = NOISY_CAPTURES[name]
            self.assertTrue(tiny_raster_noise(name, second / (name + '.png'), {'sha256':raw,'width':820,'height':1180}))


if __name__ == '__main__':
    unittest.main()
