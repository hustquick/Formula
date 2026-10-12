#!/usr/bin/env python3
import argparse
import base64
import sys


def build_engine():
    from pix2text import Pix2Text
    return Pix2Text.from_config(enable_table=False, device='cpu')


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

    result = engine.recognize_formula(args.image, return_text=True)
    if isinstance(result, (list, tuple)):
        result = result[0] if result else ''
    latex = str(result).strip()
    payload = base64.b64encode(latex.encode('utf-8')).decode('ascii')
    print('FORMULA_OCR_RESULT=' + payload)
    return 0 if latex else 2


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f'FORMULA_OCR_ERROR={type(exc).__name__}: {exc}', file=sys.stderr)
        raise
