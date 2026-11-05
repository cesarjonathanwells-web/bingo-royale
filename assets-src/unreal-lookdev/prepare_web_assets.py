"""Validate Unreal's RGBA renders and create the game's small PNG assets.

Run after render_unreal.py completes all fourteen MRQ jobs. Uses only Python's
standard library and macOS's built-in sips image resampler; no game dependency.
"""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import zlib

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
BALLS = ('b', 'i', 'n', 'g', 'o')
ICONS = ('wild_square', 'shield', 'turbo_stamp', 'ink_blot', 'number_peek',
         'scramble', 'callers_choice', 'double_daub', 'crown')


def rgba_png(path):
    """Decode non-interlaced 8-bit RGBA PNGs for actual alpha/pixel validation."""
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Not a PNG: ' + str(path))
    offset, payload = 8, bytearray()
    while offset < len(data):
        size = struct.unpack_from('>I', data, offset)[0]
        kind = data[offset + 4:offset + 8]
        chunk = data[offset + 8:offset + 8 + size]
        if kind == b'IHDR':
            width, height, depth, color, _, _, interlace = struct.unpack('>IIBBBBB', chunk)
            if (depth, color, interlace) != (8, 6, 0):
                raise ValueError('Expected 8-bit RGBA, no interlace: ' + str(path))
        elif kind == b'IDAT':
            payload.extend(chunk)
        offset += size + 12
    encoded = zlib.decompress(payload)
    stride, decoded, previous, offset = width * 4, bytearray(), bytearray(width * 4), 0
    for _ in range(height):
        mode = encoded[offset]
        row = bytearray(encoded[offset + 1:offset + 1 + stride])
        offset += stride + 1
        for index in range(stride):
            left = row[index - 4] if index >= 4 else 0
            above = previous[index]
            upper_left = previous[index - 4] if index >= 4 else 0
            if mode == 1:
                predictor = left
            elif mode == 2:
                predictor = above
            elif mode == 3:
                predictor = (left + above) // 2
            elif mode == 4:
                p = left + above - upper_left
                distances = (abs(p - left), abs(p - above), abs(p - upper_left))
                predictor = (left, above, upper_left)[distances.index(min(distances))]
            elif mode == 0:
                predictor = 0
            else:
                raise ValueError('Unsupported PNG filter')
            row[index] = (row[index] + predictor) & 255
        decoded.extend(row)
        previous = row
    return width, height, decoded


def inspect(path, expected_size):
    width, height, pixels = rgba_png(path)
    if (width, height) != (expected_size, expected_size):
        raise ValueError('Unexpected size: ' + str(path))
    occupied = [(i // 4 % width, i // 4 // width) for i in range(3, len(pixels), 4) if pixels[i] > 0]
    if not occupied:
        raise ValueError('Empty render: ' + str(path))
    xs, ys = zip(*occupied)
    bounds = [min(xs), min(ys), max(xs) + 1, max(ys) + 1]
    if bounds[0] == 0 or bounds[1] == 0 or bounds[2] == width or bounds[3] == height:
        raise ValueError('Artwork touches image border: ' + str(path))
    alpha = pixels[3::4]
    if max(alpha) != 255 or min(alpha) != 0:
        raise ValueError('Missing opaque subject or transparent background: ' + str(path))
    if not any(0 < a < 255 for a in alpha):
        raise ValueError('Missing antialiased silhouette: ' + str(path))
    return {'size': [width, height], 'mode': 'RGBA8', 'alpha_bounds': bounds,
            'transparent_border': True, 'antialiased_edges': True,
            'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def main():
    status = json.loads((ROOT / 'renders/status.json').read_text())
    names = set(BALLS + ICONS)
    if status.get('phase') != 'complete' or not status.get('success'):
        raise RuntimeError('Unreal Movie Render Queue has not completed successfully')
    if set(status.get('completed_jobs', [])) != names:
        raise RuntimeError('Render all fourteen assets before preparing web artwork')
    report = {'engine': status['unreal_version'], 'renderer': 'Unreal Movie Render Queue / deferred / software Lumen',
              'resolution': status['resolution'], 'spatial_samples': status['spatial_samples'],
              'exposure_bias': status['exposure'], 'assets': {}}
    for category, items, size in [('balls', BALLS, 256), ('icons', ICONS, 192)]:
        destination = REPO / 'apps/client/public/images' / ('unreal-' + category)
        destination.mkdir(parents=True, exist_ok=True)
        for name in items:
            source, output = ROOT / 'renders' / (name + '.0000.png'), destination / (name + '.png')
            source_qa = inspect(source, status['resolution'])
            subprocess.run(['/usr/bin/sips', '-z', str(size), str(size), str(source), '--out', str(output)],
                           check=True, capture_output=True)
            report['assets'][name] = {'source_sha256': source_qa['sha256'],
                                     'path': str(output.relative_to(REPO)), **inspect(output, size)}
    (ROOT / 'render-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'validated_assets': len(report['assets']), 'web_bytes': sum(a['bytes'] for a in report['assets'].values()),
                      'manifest': str(ROOT / 'render-manifest.json')}))


if __name__ == '__main__':
    main()
