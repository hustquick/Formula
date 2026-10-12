#!/usr/bin/env python3
import argparse
import base64
import sys


def build_engine():
    from pix2text.latex_ocr import LatexOCR
    return LatexOCR(device='cpu')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('image', nargs='?')
    parser.add_argument('--warmup', action='store_true')
    args = parser.parse_args()

    engine = build_engine()
    if args.warmup:
        print('FORMULA_OCR_READY=1')
        return 0
    if not args.image:
        parser.error('image path is required')

    result = engine.recognize(args.image)
    if isinstance(result, (list, tuple)):
        result = result[0] if result else ''
    if not isinstance(result, dict) or not isinstance(result.get('text'), str):
        raise ValueError('formula recognizer returned an invalid result')
    latex = result['text'].strip()
    if not latex:
        raise ValueError('no formula was recognized')
    payload = base64.b64encode(latex.encode('utf-8')).decode('ascii')
    print('FORMULA_OCR_RESULT=' + payload)
    return 0 if latex else 2


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f'FORMULA_OCR_ERROR={type(exc).__name__}: {exc}', file=sys.stderr)
        raise
