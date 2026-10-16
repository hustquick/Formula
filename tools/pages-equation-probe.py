#!/usr/bin/env python3
"""KNOWN UNSAFE: minimal iWork graph crashes Pages 15.4; offline investigation only."""
import argparse
import json
import struct
from pathlib import Path


def varint(n):
    out = bytearray()
    while n > 127:
        out.append((n & 127) | 128)
        n >>= 7
    out.append(n)
    return bytes(out)


def uint(field, value):
    return varint(field * 8) + varint(value)


def blob(field, value):
    if isinstance(value, str):
        value = value.encode()
    return varint(field * 8 + 2) + varint(len(value)) + value


def flt(field, value):
    return varint(field * 8 + 5) + struct.pack('<f', value)


def ref(field, identifier):
    return blob(field, uint(1, identifier))


def archive(identifier, kind, payload, refs=()):
    info = uint(1, kind) + blob(2, bytes([1, 0, 5])) + uint(3, len(payload))
    if refs:
        info += blob(5, b''.join(varint(n) for n in refs))
    header = uint(1, identifier) + blob(2, info)
    return varint(len(header)) + header + payload


def generate(latex):
    # Object IDs are local to this archive; none are copied from a document.
    root, stylesheet, storage, attachment, equation = 51, 100, 101, 102, 103
    size = flt(1, 120) + flt(2, 40)
    geometry = blob(1, flt(1, 0) + flt(2, 0)) + blob(2, size) + uint(3, 3) + flt(4, 0)
    drawable = blob(1, geometry) + uint(5, 0) + uint(7, 1) + uint(12, 0) + uint(13, 0)
    image = blob(1, drawable) + blob(4, size) + uint(7, 0) + blob(9, size) + uint(18, 0)
    color = uint(1, 1) + flt(3, 0) + flt(4, 0) + flt(5, 0) + flt(6, 1) + uint(12, 1) + flt(13, 1)
    style = flt(3, 24) + blob(5, 'HelveticaNeue') + blob(7, color)
    eq = image + blob(100, latex) + blob(101, style) + flt(102, 18) + blob(103, latex)
    attachment_run = blob(1, uint(1, 0) + ref(2, attachment))
    text = uint(1, 0) + ref(2, stylesheet) + blob(3, '\ufffc') + blob(9, attachment_run)
    native = b''.join([
        archive(root, 11000, ref(1, stylesheet) + ref(5, storage) + uint(7, 1) + uint(8, 1), [stylesheet, storage]),
        archive(stylesheet, 401, uint(4, 0)),
        archive(storage, 2001, text, [stylesheet, attachment]),
        archive(attachment, 2003, ref(1, equation) + uint(2, 0) + flt(3, 0) + uint(4, 0) + flt(5, 0), [equation]),
        archive(equation, 3005, eq),
    ])
    metadata = archive(52, 11007, blob(1, bytes([26, 4, 0])) + blob(2, 'com.apple.Pages 15.4') + blob(7, bytes([2, 0, 0])))
    return {
        'com.apple.iWork.TSPNativeData': native,
        'com.apple.iWork.TSPNativeMetadata': metadata,
        'com.apple.iWork.pasteboardState.hasNativeEquation': b'',
        'com.apple.iWork.pasteboardState.hasNativeDrawables': b'',
        'com.apple.iWork.pasteboardState.hasNativeTypes': b'',
        'com.apple.iWork.pasteboardState.hasTextStoragesAttachmentsAllowed': b'',
        'com.apple.iWork.pasteboardState.elementKinds-4096': b'',
        'com.apple.iWork.pasteboardState.attachedElementKinds-4096': b'',
        'com.apple.iWork.pasteboardState.countOfObject-1': b'',
        'com.apple.iWork.pasteboardState.numberOfDrawables-1': b'',
        'com.apple.iWork.pasteboardState.applicationName-Pages': b'',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--allow-known-crashing-payload', action='store_true', help='Explicitly acknowledge that pasting this payload crashed Pages')
    parser.add_argument('latex')
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if not args.allow_known_crashing_payload:
        parser.error('Quarantined experiment: payload crashed Pages; not suitable for clipboard use')
    args.output.mkdir(parents=True, exist_ok=False)
    entries = []
    for i, (kind, data) in enumerate(generate(args.latex).items()):
        name = f'type-{i}.bin'
        (args.output / name).write_bytes(data)
        entries.append(dict(item=0, type=kind, file=name, bytes=len(data)))
    (args.output / 'manifest.json').write_text(json.dumps(dict(stable=True, carbonRepresentations=entries), indent=2))
