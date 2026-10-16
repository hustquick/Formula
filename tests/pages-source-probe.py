#!/usr/bin/env python3
"""Offline protocol checks; no UI or clipboard side effects."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('pages_source_probe', ROOT / 'tools/pages-source-probe.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


def record(kind, payload):
    info = p.encode([(1, 0, kind), (2, 2, bytes([1, 0, 5])), (3, 0, len(payload)), (9, 2, b'unknown-info')])
    header = p.encode([(1, 0, 123), (2, 2, info), (13, 0, 7)])
    return p.varint(len(header)) + header + payload


class SourceProbeTest(unittest.TestCase):
    def test_unknown_fields_and_long_utf8_source(self):
        equation = p.encode([(1, 2, b'opaque-super'), (100, 2, b'x'), (103, 2, b'x'), (111, 5, b'1234')])
        other = record(401, p.encode([(5, 2, b'untouched')]))
        source = '\\mathrm{' + 'α' * 200 + '}'
        rebuilt = p.rebuild(other + record(3005, equation), source)
        self.assertTrue(rebuilt.startswith(other))
        pos = len(other)
        length, pos = p.read_varint(rebuilt, pos)
        header = p.fields(rebuilt[pos:pos + length])
        pos += length
        info = p.fields(next(v for f, w, v in header if f == 2))
        self.assertEqual(next(v for f, w, v in info if f == 3), len(rebuilt) - pos)
        self.assertIn((9, 2, b'unknown-info'), info)
        self.assertIn((13, 0, 7), header)
        fs = p.fields(rebuilt[pos:])
        self.assertIn((1, 2, b'opaque-super'), fs)
        self.assertIn((111, 5, b'1234'), fs)
        self.assertIn((100, 2, source.encode()), fs)
        self.assertIn((103, 2, source.encode()), fs)

    def test_rejects_truncation_and_ambiguous_sources(self):
        eq = record(3005, p.encode([(100, 2, b'x'), (103, 2, b'x')]))
        for data in (eq[:-1], eq + eq, record(3005, p.encode([(100, 2, b'x')])), b'\xff'):
            with self.subTest(data=data):
                with self.assertRaises(ValueError):
                    p.rebuild(data, 'y')

    def test_real_sample_identity_when_available(self):
        folder = ROOT / 'build/pasteboard-audit/pages-native-equation-01'
        if not folder.exists():
            self.skipTest('Local Pages sample unavailable')
        import json
        manifest = json.loads((folder / 'manifest.json').read_text())
        entry = next(r for r in manifest['carbonRepresentations'] if r['type'] == 'com.apple.iWork.TSPNativeData')
        data = (folder / entry['file']).read_bytes()
        self.assertEqual(p.rebuild(data, r'\sin\cos x+\arctan\frac{x}{y}'), data)


if __name__ == '__main__':
    unittest.main()
