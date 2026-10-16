#!/usr/bin/env python3
"""Rebuild both LaTeX fields in one captured Pages equation (research only).

Preserves the sample's entire object graph. Does not generate an independent
Pages package and does not write the system clipboard. Use pasteboard-replay
separately in a disposable test document.
"""
import argparse
import hashlib
import json
from pathlib import Path


def read_varint(data, pos):
    value = 0
    for shift in range(0, 70, 7):
        if pos >= len(data):
            raise ValueError('Truncated varint')
        byte = data[pos]
        pos += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, pos
    raise ValueError('Oversized varint')


def varint(value):
    out = bytearray()
    while value > 127:
        out.append((value & 127) | 128)
        value >>= 7
    out.append(value)
    return bytes(out)


def fields(data):
    pos, result = 0, []
    while pos < len(data):
        key, pos = read_varint(data, pos)
        field, wire = key >> 3, key & 7
        if not field:
            raise ValueError('Invalid field zero')
        if wire == 0:
            value, pos = read_varint(data, pos)
        elif wire in (1, 2, 5):
            if wire == 2:
                length, pos = read_varint(data, pos)
            else:
                length = 8 if wire == 1 else 4
            if length > len(data) - pos:
                raise ValueError('Truncated field')
            value = data[pos:pos + length]
            pos += length
        else:
            raise ValueError(f'Unsupported wire type {wire}')
        result.append((field, wire, value))
    return result


def encode(items):
    out = bytearray()
    for field, wire, value in items:
        out.extend(varint(field * 8 + wire))
        if wire == 0:
            out.extend(varint(value))
        else:
            if wire == 2:
                out.extend(varint(len(value)))
            out.extend(value)
    return bytes(out)


def rebuild(data, latex):
    source = latex.encode('utf-8')
    if not source or len(source) > 1_000_000:
        raise ValueError('Invalid source length')
    pos, result, count = 0, bytearray(), 0
    while pos < len(data):
        length, pos = read_varint(data, pos)
        if length > len(data) - pos:
            raise ValueError('Truncated archive header')
        header = fields(data[pos:pos + length])
        pos += length
        payloads, new_header = [], []
        for field, wire, value in header:
            if field == 2 and wire == 2:
                info = fields(value)
                kind = next(v for f, w, v in info if f == 1 and w == 0)
                size = next(v for f, w, v in info if f == 3 and w == 0)
                if size > len(data) - pos:
                    raise ValueError('Truncated archive payload')
                payload = data[pos:pos + size]
                pos += size
                if kind == 3005:
                    equation = fields(payload)
                    for key in (100, 103):
                        if sum(f == key and w == 2 for f, w, v in equation) != 1:
                            raise ValueError('Unknown equation source schema')
                    payload = encode([(f, w, source if f in (100, 103) else v) for f, w, v in equation])
                    count += 1
                value = encode([(f, w, len(payload) if f == 3 and w == 0 else v) for f, w, v in info])
                payloads.append(payload)
            new_header.append((field, wire, value))
        packed = encode(new_header)
        result.extend(varint(len(packed)) + packed + b''.join(payloads))
    if count != 1:
        raise ValueError(f'Expected one equation, found {count}')
    return bytes(result)


def create_capture(sample, output, latex):
    manifest = json.loads((sample / 'manifest.json').read_text())
    if manifest.get('stable') is not True:
        raise ValueError('Unstable sample')
    entries = [r for r in manifest['carbonRepresentations'] if r['type'].startswith('com.apple.iWork.')]
    loaded = []
    for entry in entries:
        name = entry['file']
        if Path(name).name != name:
            raise ValueError('Invalid captured filename')
        data = (sample / name).read_bytes()
        if entry['type'] == 'com.apple.iWork.TSPNativeData':
            data = rebuild(data, latex)
        loaded.append((entry['type'], data))
    if not any(kind == 'com.apple.iWork.TSPNativeData' for kind, _ in loaded):
        raise ValueError('Missing native data')
    output.mkdir(parents=True, exist_ok=False)
    written = []
    for i, (kind, data) in enumerate(loaded):
        name = f'type-{i}.bin'
        (output / name).write_bytes(data)
        written.append(dict(item=0, type=kind, file=name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
    (output / 'manifest.json').write_text(json.dumps(dict(stable=True, experimental=True, carbonRepresentations=written), indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sample', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('latex')
    args = parser.parse_args()
    create_capture(args.sample, args.output, args.latex)
