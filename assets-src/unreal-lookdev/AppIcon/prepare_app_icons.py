"""Validate the completed Unreal still and export app/install/browser icons.

No painting or alternate rendering takes place here. macOS sips only resamples
Unreal's delivered pixels and adds the maskable icon's plain navy safety border.
Run from any directory after the final 2048px / 64-sample MRQ job completes.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
PUBLIC = REPO / 'apps/client/public'
NAME = 'bingo-royale-icon'

_spec = importlib.util.spec_from_file_location(
    '_bingo_icon_png_reader', ROOT.parent / 'prepare_web_assets.py')
_png = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_png)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect_opaque(path, size):
    width, height, pixels = _png.rgba_png(path)
    if (width, height) != (size, size):
        raise ValueError('Unexpected PNG dimensions: ' + str(path))
    if min(pixels[3::4]) != 255:
        raise ValueError('Install icons must be fully opaque: ' + str(path))
    return {
        'path': str(path.relative_to(REPO)), 'size': [width, height],
        'mode': 'RGBA8', 'opaque': True, 'bytes': path.stat().st_size,
        'sha256': digest(path),
    }, tuple(pixels[:3])


def resize(source, output, size):
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['/usr/bin/sips', '-z', str(size), str(size), str(source),
                    '--out', str(output)], check=True, capture_output=True)
    return inspect_opaque(output, size)[0]


def main():
    status_path = ROOT / 'renders/status.json'
    status = json.loads(status_path.read_text())
    if status.get('phase') != 'complete' or status.get('success') is not True:
        raise RuntimeError('The Unreal icon render has not completed successfully')
    if set(status.get('completed_jobs', [])) != {NAME}:
        raise RuntimeError('The completed MRQ job must be the app icon')
    if status.get('resolution', 0) < 2048 or status.get('spatial_samples', 0) < 64:
        raise RuntimeError('Export the final 2048px / 64-sample render, not a preview')
    if any(error.get('fatal') for error in status.get('errors', [])):
        raise RuntimeError('The Unreal render receipt contains a fatal error')
    if not status.get('unreal_version'):
        raise RuntimeError('The render receipt must identify Unreal Engine')

    source = ROOT / 'renders' / (NAME + '.0000.png')
    source_qa, corner = inspect_opaque(source, status['resolution'])
    mesh_manifest = json.loads((ROOT / 'SourceMeshes/mesh-manifest.json').read_text())
    mesh = ROOT / 'SourceMeshes' / mesh_manifest['fbx']
    if digest(mesh) != mesh_manifest['sha256']:
        raise RuntimeError('Blender FBX does not match its source manifest')

    masters = ROOT / 'masters'
    masters.mkdir(parents=True, exist_ok=True)
    master = masters / 'bingo-royale-icon-2048.png'
    if status['resolution'] == 2048:
        shutil.copyfile(source, master)
        master_qa = inspect_opaque(master, 2048)[0]
    else:
        master_qa = resize(source, master, 2048)

    targets = [
        ('app_192', PUBLIC / 'icons/icon-192.png', 192),
        ('app_512', PUBLIC / 'icons/icon-512.png', 512),
        ('apple_touch', PUBLIC / 'apple-touch-icon.png', 180),
        ('favicon_32', PUBLIC / 'icons/favicon-32.png', 32),
        ('favicon_64', PUBLIC / 'icons/favicon-64.png', 64),
        ('download_1024', PUBLIC / 'icons/bingo-royale-icon-1024.png', 1024),
    ]
    assets = {name: resize(master, output, size) for name, output, size in targets}

    # Resample the entire composition to 460px, then add 26px per side. Critical
    # crown/ball geometry remains inside the circular 40%-radius maskable zone;
    # the plaque and frame are decorative and can be cropped by an OS mask.
    maskable = PUBLIC / 'icons/maskable-512.png'
    color = ''.join(f'{channel:02X}' for channel in corner)
    with tempfile.TemporaryDirectory(prefix='bingo-icon-') as temporary:
        inset = Path(temporary) / 'inset.png'
        subprocess.run(['/usr/bin/sips', '-z', '460', '460', str(master), '--out', str(inset)],
                       check=True, capture_output=True)
        subprocess.run(['/usr/bin/sips', '-p', '512', '512', '--padColor', color,
                        str(inset), '--out', str(maskable)], check=True, capture_output=True)
    assets['maskable_512'] = inspect_opaque(maskable, 512)[0]
    assets['maskable_512']['padding_px_per_side'] = 26
    assets['maskable_512']['padding_color'] = '#' + color.lower()
    assets['maskable_512']['safe_zone'] = {
        'circle_radius_fraction': 0.4,
        'critical_crown_ball_radius_fraction_estimate': round(1.08 / 2.65 * 460 / 512, 4),
        'method': 'Conservative model geometry and orthographic framing; visual review required',
    }

    report = {
        'engine': status['unreal_version'],
        'renderer': status.get('renderer', 'Unreal Movie Render Queue / software Lumen'),
        'resolution': status['resolution'],
        'spatial_samples': status['spatial_samples'],
        'exposure_bias': status['exposure'],
        'render_status': {'path': str(status_path.relative_to(REPO)),
                          'phase': status['phase'], 'success': status['success'],
                          'completed_jobs': status['completed_jobs'],
                          'sha256': digest(status_path)},
        'source_render': source_qa,
        'blender_mesh': {'path': str(mesh.relative_to(REPO)), 'sha256': digest(mesh),
                         'vertices': mesh_manifest['vertices'],
                         'triangles': mesh_manifest['triangles']},
        'editable_blend': {'path': str((ROOT / 'bingo-royale-app-icon.blend').relative_to(REPO)),
                           'sha256': digest(ROOT / 'bingo-royale-app-icon.blend')},
        'master': master_qa,
        'resampler': '/usr/bin/sips; resampling and uniform navy padding only',
        'assets': assets,
    }
    report_path = ROOT / 'render-manifest.json'
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'validated_exports': len(assets),
                      'web_bytes': sum(a['bytes'] for a in assets.values()),
                      'manifest': str(report_path)}))


if __name__ == '__main__':
    main()
