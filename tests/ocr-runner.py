"""Exercise geometry filtering and isolated-page routing without downloading weights."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('runner', Path('macos/formula-ocr-runner.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)

class Image:
    size = (200, 100)
    def copy(self): return self
    def convert(self, mode): return self

class RunnerTests(unittest.TestCase):
    def test_detector_filters_and_orders_formula_boxes(self):
        found = [
            {'type': 'isolated', 'box': [[70, 60], [170, 90]]},
            {'type': 'text', 'box': [[0, 0], [200, 100]]},
            {'type': 'embedding', 'box': [[-10, 10], [70, 40]]},
            {'type': 'isolated', 'box': [[0, 0], [1, 1]]},
            {'box': [[float('nan'), 0], [20, 10]]},
        ]
        with patch.object(runner, 'build_detector', return_value=lambda *a, **k: found):
            regions = runner.detect_formula_regions(Image())
        self.assertEqual(len(regions), 2)
        self.assertEqual([r['type'] for r in regions], ['embedding', 'isolated'])
        self.assertEqual(regions[0]['bbox'][0], 0)
        self.assertTrue(all(0 <= x <= 200 for r in regions for x in r['bbox'][::2]))

    def test_pix2text_single_and_batch_outputs(self):
        class Engine:
            def recognize(self, images, batch_size):
                return [{'text': ' x^2 ', 'score': .9}, 'y']
        self.assertEqual(runner.recognize_pix2text(Engine(), [1, 2]),
                         [{'text': 'x^2', 'score': .9}, {'text': 'y', 'score': None}])

if __name__ == '__main__':
    unittest.main()
