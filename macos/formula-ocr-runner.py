#!/usr/bin/env python3
import argparse
import base64
import sys


def build_engine(warmup=False):
    from pix2text.latex_ocr import LatexOCR
    from pix2text.consts import MODEL_VERSION, AVAILABLE_MODELS
    from pix2text.utils import data_dir, prepare_model_files2
    from pathlib import Path
    info = AVAILABLE_MODELS.get_info('mfr-1.5', 'onnx')
    model_dir = Path(data_dir()) / MODEL_VERSION / info['local_model_id']
    if warmup:
        # Resume an interrupted download even when config files already exist.
        prepare_model_files2(model_dir, info['hf_model_id'], file_or_dir='dir')
    return LatexOCR(device='cpu', model_dir=str(model_dir))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('image', nargs='?')
    parser.add_argument('--warmup', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()

    if args.check:
        from pix2text.latex_ocr import LatexOCR
        print('FORMULA_OCR_DEPENDENCIES_READY=1')
        return 0

    engine = build_engine(warmup=args.warmup)
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
