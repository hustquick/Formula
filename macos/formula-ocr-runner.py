#!/usr/bin/env python3
import argparse
import base64
import json
import sys
from pathlib import Path


def emit(prefix, value):
    payload = base64.b64encode(value.encode('utf-8')).decode('ascii')
    print(prefix + payload)


def build_pix2text_engine(warmup=False):
    from pix2text.latex_ocr import LatexOCR
    from pix2text.consts import MODEL_VERSION, AVAILABLE_MODELS
    from pix2text.utils import data_dir, prepare_model_files2

    info = AVAILABLE_MODELS.get_info('mfr-1.5', 'onnx')
    model_dir = Path(data_dir()) / MODEL_VERSION / info['local_model_id']
    if warmup:
        prepare_model_files2(model_dir, info['hf_model_id'], file_or_dir='dir')
    return LatexOCR(device='cpu', model_dir=str(model_dir))


def build_detector():
    # Pix2Text's MFD 1.5 detector is deliberately used directly here.  We do
    # not construct TextFormulaOCR, so no normal-text OCR is performed.
    from pix2text.formula_detector import MathFormulaDetector
    return MathFormulaDetector(device='cpu')


def unimernet_paths(root):
    model_dir = root / 'models' / 'unimernet_tiny'
    cfg = root / 'unimernet-tiny.yaml'
    return model_dir, cfg


def prepare_unimernet(root):
    from huggingface_hub import snapshot_download

    model_dir, cfg = unimernet_paths(root)
    model_dir.parent.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id='wanderkid/unimernet_tiny',
        local_dir=str(model_dir),
    )
    checkpoint = model_dir / 'unimernet_tiny.pth'
    if not checkpoint.exists():
        raise FileNotFoundError(f'UniMERNet Tiny checkpoint missing: {checkpoint}')
    model_path = str(model_dir).replace("'", "''")
    checkpoint_path = str(checkpoint).replace("'", "''")
    cfg.write_text(f'''model:\n  arch: unimernet\n  model_type: unimernet\n  model_config:\n    model_name: '{model_path}'\n    max_seq_len: 1536\n  load_pretrained: True\n  pretrained: '{checkpoint_path}'\n  tokenizer_config:\n    path: '{model_path}'\ndatasets:\n  formula_rec_eval:\n    vis_processor:\n      eval:\n        name: formula_image_eval\n        image_size: [192, 672]\nrun:\n  runner: runner_iter\n  task: unimernet_train\n  batch_size_train: 1\n  batch_size_eval: 1\n  num_workers: 0\n  seed: 42\n  output_dir: '{str(root / 'unimernet-output')}'\n  evaluate: True\n  test_splits: [eval]\n  device: cpu\n  world_size: 1\n  dist_url: env://\n  distributed: False\n  distributed_type: ddp\n  generate_cfg:\n    temperature: 0.0\n''', encoding='utf-8')
    return model_dir, cfg


def build_unimernet_engine(root, warmup=False):
    import torch
    from unimernet.common.config import Config
    import unimernet.tasks as tasks
    from unimernet.processors import load_processor

    model_dir, cfg_path = unimernet_paths(root)
    if warmup or not cfg_path.exists():
        model_dir, cfg_path = prepare_unimernet(root)
    args = argparse.Namespace(cfg_path=str(cfg_path), options=None)
    cfg = Config(args)
    task = tasks.setup_task(cfg)
    model = task.build_model(cfg).to(torch.device('cpu'))
    model.eval()
    processor = load_processor(
        'formula_image_eval',
        cfg.config.datasets.formula_rec_eval.vis_processor.eval,
    )
    return model, processor


def recognize_pix2text(engine, images):
    out = engine.recognize(images, batch_size=1)
    if isinstance(out, dict):
        out = [out]
    results = []
    for item in out or []:
        if isinstance(item, str):
            results.append({'text': item.strip(), 'score': None})
        elif isinstance(item, dict):
            results.append({'text': str(item.get('text', '')).strip(), 'score': item.get('score')})
        else:
            results.append({'text': '', 'score': None})
    return results


def recognize_unimernet(engine, images):
    import torch
    model, processor = engine
    results = []
    with torch.inference_mode():
        for image in images:
            tensor = processor(image.convert('RGB')).unsqueeze(0).to(torch.device('cpu'))
            output = model.generate({'image': tensor})
            pred = output.get('pred_str', [''])[0]
            results.append({'text': str(pred).strip(), 'score': None})
    return results


def recognize(engine_name, images, root, warmup=False):
    if engine_name == 'pix2text':
        engine = build_pix2text_engine(warmup=warmup)
        return recognize_pix2text(engine, images)
    if engine_name == 'unimernet':
        engine = build_unimernet_engine(root, warmup=warmup)
        if warmup:
            return []
        return recognize_unimernet(engine, images)
    raise ValueError(f'unknown OCR engine: {engine_name}')


def detect_formula_regions(image):
    detector = build_detector()
    width, height = image.size
    target_w = min(1600, max(768, width))
    scale = target_w / max(width, 1)
    target_shape = (max(64, int(height * scale)), target_w)
    found = detector(image.copy().convert('RGB'), resized_shape=target_shape)
    regions = []
    for item in found or []:
        box = item.get('box')
        kind = item.get('type', 'formula')
        if box is None:
            continue
        pts = box.tolist() if hasattr(box, 'tolist') else box
        xs = [float(p[0]) for p in pts]
        ys = [float(p[1]) for p in pts]
        x0, y0 = max(0, int(min(xs))), max(0, int(min(ys)))
        x1, y1 = min(width, int(max(xs))), min(height, int(max(ys)))
        if x1 - x0 < 3 or y1 - y0 < 3:
            continue
        pad = max(2, min(12, int((y1 - y0) * 0.08)))
        regions.append({
            'type': kind,
            'bbox': [max(0, x0-pad), max(0, y0-pad), min(width, x1+pad), min(height, y1+pad)],
        })
    regions.sort(key=lambda r: (r['bbox'][1], r['bbox'][0]))
    return regions


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('image', nargs='?')
    parser.add_argument('--engine', choices=['pix2text', 'unimernet'], default='pix2text')
    parser.add_argument('--page', action='store_true', help='detect all formula regions before recognition')
    parser.add_argument('--warmup', action='store_true')
    parser.add_argument('--warmup-detector', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--root', default='.')
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)

    if args.check:
        if args.engine == 'pix2text':
            from pix2text.latex_ocr import LatexOCR  # noqa: F401
        else:
            from unimernet.common.config import Config  # noqa: F401
        print('FORMULA_OCR_DEPENDENCIES_READY=1')
        return 0

    if args.warmup_detector:
        build_detector()
        print('FORMULA_MFD_READY=1')
        if not args.warmup:
            return 0

    if args.warmup:
        if args.engine == 'pix2text':
            build_pix2text_engine(warmup=True)
        else:
            build_unimernet_engine(root, warmup=True)
        print(f'FORMULA_OCR_READY={args.engine}')
        return 0

    if not args.image:
        parser.error('image path is required')

    from PIL import Image
    image = Image.open(args.image).convert('RGB')
    if args.page:
        regions = detect_formula_regions(image)
        if not regions:
            emit('FORMULA_OCR_PAGE=', json.dumps([], ensure_ascii=False))
            return 0
        crops = [image.crop(tuple(r['bbox'])) for r in regions]
        recognized = recognize(args.engine, crops, root)
        formulas = []
        for region, rec in zip(regions, recognized):
            latex = rec.get('text', '').strip()
            if latex:
                formulas.append({
                    'latex': latex,
                    'type': region['type'],
                    'bbox': region['bbox'],
                    'score': rec.get('score'),
                })
        emit('FORMULA_OCR_PAGE=', json.dumps(formulas, ensure_ascii=False))
        return 0

    recognized = recognize(args.engine, [image], root)
    latex = recognized[0].get('text', '').strip() if recognized else ''
    if not latex:
        raise ValueError('no formula was recognized')
    emit('FORMULA_OCR_RESULT=', latex)
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f'FORMULA_OCR_ERROR={type(exc).__name__}: {exc}', file=sys.stderr)
        raise
