"""Turn the Unreal renders of the ball machine into the game's two WebP layers.

Run after render_machine.py reports "complete":

    python3 assets-src/unreal-lookdev/Stage/prepare_stage_assets.py

  machine-back.webp   = the machine-back render
  machine-front.webp  = the machine-front render over the glass highlights

Movie Render Queue writes colour already multiplied by coverage; browsers
expect straight alpha, so each pixel's colour is divided by its alpha. The
glass is rendered as a dark mirror: its brightness becomes the alpha of a
see-through highlight layer, so dark glass is clear and a reflected softbox
is a bright, solid highlight.

Uses only Python's standard library and cwebp (`brew install webp`).
"""
import hashlib
import json
import struct
import subprocess
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
RENDERS = ROOT / 'renders'
DELIVERY = REPO / 'apps/client/public/images/stage'
RENDERED = ('machine-back', 'machine-front', 'machine-glass')
SIZE = (900, 920)


def read_rgba(path):
    """Decode a non-interlaced 8-bit RGBA PNG."""
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Not a PNG: ' + str(path))
    offset, payload, width, height = 8, bytearray(), 0, 0
    while offset < len(data):
        size = struct.unpack_from('>I', data, offset)[0]
        kind = data[offset + 4:offset + 8]
        chunk = data[offset + 8:offset + 8 + size]
        if kind == b'IHDR':
            width, height, depth, colour, _, _, interlace = struct.unpack('>IIBBBBB', chunk)
            if (depth, colour, interlace) != (8, 6, 0):
                raise ValueError('Expected 8-bit RGBA without interlacing: ' + str(path))
        elif kind == b'IDAT':
            payload.extend(chunk)
        offset += size + 12
    encoded = zlib.decompress(bytes(payload))
    stride = width * 4
    pixels = bytearray(stride * height)
    previous = bytearray(stride)
    position = 0
    for row in range(height):
        mode = encoded[position]
        line = bytearray(encoded[position + 1:position + 1 + stride])
        position += stride + 1
        if mode == 1:
            for i in range(4, stride):
                line[i] = (line[i] + line[i - 4]) & 255
        elif mode == 2:
            for i in range(stride):
                line[i] = (line[i] + previous[i]) & 255
        elif mode == 3:
            for i in range(stride):
                left = line[i - 4] if i >= 4 else 0
                line[i] = (line[i] + ((left + previous[i]) >> 1)) & 255
        elif mode == 4:
            for i in range(stride):
                left = line[i - 4] if i >= 4 else 0
                up = previous[i]
                corner = previous[i - 4] if i >= 4 else 0
                estimate = left + up - corner
                a, b, c = abs(estimate - left), abs(estimate - up), abs(estimate - corner)
                nearest = left if a <= b and a <= c else up if b <= c else corner
                line[i] = (line[i] + nearest) & 255
        elif mode != 0:
            raise ValueError('Unknown PNG filter {} in {}'.format(mode, path))
        pixels[row * stride:(row + 1) * stride] = line
        previous = line
    return width, height, pixels


def write_rgba(path, width, height, pixels):
    """Write an 8-bit RGBA PNG (no filtering; it is only an intermediate file)."""
    stride = width * 4
    raw = b''.join(b'\x00' + bytes(pixels[row * stride:(row + 1) * stride]) for row in range(height))

    def chunk(kind, body):
        return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)

    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
                     + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))


def straighten(pixels):
    """Premultiplied colour -> straight alpha."""
    for i in range(0, len(pixels), 4):
        r, g, b, a = pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]
        alpha = max(r, g, b, a)
        if alpha == 0:
            pixels[i] = pixels[i + 1] = pixels[i + 2] = 0
            continue
        if alpha < 255:
            pixels[i] = min(255, (r * 255 + alpha // 2) // alpha)
            pixels[i + 1] = min(255, (g * 255 + alpha // 2) // alpha)
            pixels[i + 2] = min(255, (b * 255 + alpha // 2) // alpha)
        pixels[i + 3] = alpha
    return pixels


def highlights(pixels, floor=6):
    """Dark-mirror render -> see-through highlights: brightness becomes alpha."""
    for i in range(0, len(pixels), 4):
        r, g, b = pixels[i], pixels[i + 1], pixels[i + 2]
        alpha = max(r, g, b)
        if alpha <= floor:  # render noise in the unlit glass stays fully clear
            pixels[i] = pixels[i + 1] = pixels[i + 2] = pixels[i + 3] = 0
            continue
        pixels[i] = min(255, (r * 255 + alpha // 2) // alpha)
        pixels[i + 1] = min(255, (g * 255 + alpha // 2) // alpha)
        pixels[i + 2] = min(255, (b * 255 + alpha // 2) // alpha)
        pixels[i + 3] = alpha
    return pixels


def over(top, bottom):
    """Straight-alpha 'top over bottom', returned as a new buffer."""
    out = bytearray(len(top))
    for i in range(0, len(top), 4):
        ta, ba = top[i + 3], bottom[i + 3]
        if ta == 255 or ba == 0:
            out[i:i + 4] = top[i:i + 4]
            continue
        if ta == 0:
            out[i:i + 4] = bottom[i:i + 4]
            continue
        under = ba * (255 - ta)                # bottom's remaining weight, x255
        alpha = ta * 255 + under               # x255
        for c in range(3):
            out[i + c] = min(255, (top[i + c] * ta * 255 + bottom[i + c] * under + alpha // 2) // alpha)
        out[i + 3] = min(255, (alpha + 127) // 255)
    return out


def main(quality=90):
    DELIVERY.mkdir(parents=True, exist_ok=True)
    manifest = {'engine': 'Unreal Engine Movie Render Queue', 'layers': {}}
    status = RENDERS / 'status.json'
    if status.is_file():
        state = json.loads(status.read_text(encoding='utf-8'))
        if state.get('phase') != 'complete' or not state.get('success'):
            raise SystemExit('The Unreal render is not complete: ' + str(state.get('phase')))
        manifest.update(unreal_version=state.get('unreal_version'), spatial_samples=state.get('spatial_samples'),
                        exposure=state.get('exposure'))
    sources, images = {}, {}
    for name in RENDERED:
        source = RENDERS / (name + '.0000.png')
        width, height, pixels = read_rgba(source)
        if (width, height) != SIZE:
            raise SystemExit('{} is {}x{}, expected {}x{}'.format(source.name, width, height, *SIZE))
        opaque = sum(1 for i in range(3, len(pixels), 4) if pixels[i] == 255)
        clear = sum(1 for i in range(3, len(pixels), 4) if pixels[i] == 0)
        if opaque < 20000 or clear < 100000:
            raise SystemExit('{} does not look like a machine on a clear background'.format(source.name))
        sources[name], images[name] = source, pixels
    width, height = SIZE
    glass = highlights(images['machine-glass'])
    lit = sum(1 for i in range(3, len(glass), 4) if glass[i] > 96)
    if lit < 1500:
        raise SystemExit('The glass render has no highlights ({} bright pixels)'.format(lit))
    layers = {
        'machine-back': (straighten(images['machine-back']), ['machine-back']),
        'machine-front': (over(straighten(images['machine-front']), glass), ['machine-front', 'machine-glass']),
    }
    for layer, (pixels, made_from) in layers.items():
        target = DELIVERY / (layer + '.webp')
        straight = RENDERS / (layer + '.straight.png')
        write_rgba(straight, width, height, pixels)
        subprocess.run(['cwebp', '-quiet', '-q', str(quality), '-alpha_q', '100', '-m', '6',
                        str(straight), '-o', str(target)], check=True)
        manifest['layers'][layer] = {
            'source_png_sha256': {name: hashlib.sha256(sources[name].read_bytes()).hexdigest() for name in made_from},
            'webp': str(target.relative_to(REPO)), 'webp_bytes': target.stat().st_size,
            'webp_sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
            'size': [width, height], 'glass_highlight_pixels': lit if layer == 'machine-front' else 0,
        }
        print(layer, target.stat().st_size, 'bytes')
    (ROOT / 'render-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 90)
