# Bingo Royale app icon

An original cobalt bingo ball, an ivory B/7 medallion, a beveled champagne-gold
crown, and a midnight enamel plaque. The geometry is built in Blender and the
delivery pixels are rendered in Unreal Engine's Movie Render Queue. No purchased
models, external textures, AI image generation, or runtime dependencies are used.

## Editable sources

- `build_blender_icon.py` creates the isolated Blender scene and its PBR materials.
- `bingo-royale-app-icon.blend` contains the editable scene and its dependencies.
- `SourceMeshes/SM_BingoRoyaleAppIcon.fbx` is the evaluated, triangulated mesh.
- `SourceMeshes/mesh-manifest.json` records material values, geometry counts, and
  the FBX SHA-256 digest.
- `render_app_icon.py` imports the mesh into `/Game/BingoAppIcon` in the existing
  `BingoRoyaleLookdev.uproject`, builds the icon studio, and queues one still.
- `prepare_app_icons.py` validates the completed Unreal receipt and exports the
  install, browser, and downloadable icon sizes with macOS's built-in `sips`.

The build script preserves the user's previous Blender scene. The Unreal script
uses its own content folder and a private render queue. Its generated map and
sequence can be rebuilt from the source scripts and FBX.

The generated `.blend`, `.fbx`, Unreal content, and intermediate renders are kept
locally rather than committed as large binary source files. The procedural
Blender script is the reproducible source: on a fresh checkout, run it before the
Unreal import. The source manifest and final render manifest record the hashes
of the actual local files used for delivery.

## Rebuild

1. In Blender's Python Console, run the source script from this checkout:

   ```python
   import runpy
   runpy.run_path('/absolute/path/to/AppIcon/build_blender_icon.py', run_name='__main__')
   ```

2. Open `../BingoRoyaleLookdev.uproject` in Unreal Editor with Python scripting,
   Editor Scripting Utilities, Sequencer Scripting, and Movie Render Queue enabled.
   In its Python Console, load and run the icon studio:

   ```python
   import importlib.util, sys
   path = '/absolute/path/to/AppIcon/render_app_icon.py'
   spec = importlib.util.spec_from_file_location('bingo_app_icon_studio', path)
   module = importlib.util.module_from_spec(spec)
   sys.modules[spec.name] = module
   spec.loader.exec_module(module)
   module.main(resolution=2048, samples=64)
   ```

   Keep Unreal open until `renders/status.json` reports `phase: complete` and
   `success: true`. The still is `renders/bingo-royale-icon.0000.png`.

3. From the repository root:

   ```sh
   python3 assets-src/unreal-lookdev/AppIcon/prepare_app_icons.py
   node --test apps/client/tests/pwa.test.mjs
   ```

The export script rejects preview quality, an incomplete or failed MRQ receipt,
nonopaque pixels, incorrect dimensions, and a source mesh whose hash no longer
matches its manifest. `render-manifest.json` records the actual engine version,
render quality, source mesh, editable scene, status receipt, and image hashes.

## Lighting and material settings

The front orthographic camera uses a 106cm width around a mesh normalized to a
100cm maximum dimension. Manual exposure compensation is locked to **−5 EV**;
physical camera exposure is disabled. Lumen global illumination and reflections
use quality 4 with software tracing. Motion blur, chromatic aberration, grain,
vignette, and bloom are disabled so the icon stays clean at small sizes.

Four movable rectangular lights shape the surfaces:

| Light | Position (cm) | Intensity | Size (cm) | Temperature |
| --- | --- | --- | --- | --- |
| Key | 210, 170, 190 | 2100 lm | 220 × 260 | 5000 K |
| Fill | 180, −130, −100 | 420 lm | 300 × 300 | 7000 K |
| Rim | −40, −125, 135 | 650 lm | 100 × 160 | 6500 K |
| Gold reflection | 280, 85, 120 | 600 lm | 250 × 200 | 5500 K |

Only the key casts shadows; the fill, rim, and gold-reflection lights contribute
color and readable reflections without introducing competing shadow directions.
Virtual Shadow Maps are enabled. Local SMRT tracing uses **16 rays**, **8 samples
per ray**, adaptive ray count **0**, and maximum ray angle from light **0.1** for
a soft, stable key-shadow penumbra.

Cobalt resin starts at roughness **0.19**, clear coat **0.48**, and coat roughness
**0.12**. Gold uses metallic **1.0** and roughness **0.24**. Unreal adds a restrained
±0.03 roughness range with built-in noise. Colors are converted from sRGB to
linear values before material assignment. The opaque full-bleed navy backing is
rendered in Unreal, with its emissive value compensated for the fixed exposure.

The final master uses **2048 × 2048**, **64 spatial samples**, one temporal sample,
and 64 warm-up frames. Unreal's filmic tone curve remains enabled. Delivery should
only be described as rendered in Unreal after the completed receipt has passed
the export script.

## Delivery sizes and crop safety

| Output | Size | Purpose |
| --- | --- | --- |
| `masters/bingo-royale-icon-2048.png` | 2048 × 2048 | Archival master |
| `public/icons/bingo-royale-icon-1024.png` | 1024 × 1024 | Downloadable artwork |
| `public/icons/icon-512.png` | 512 × 512 | Install icon |
| `public/icons/icon-192.png` | 192 × 192 | Install and offline-page icon |
| `public/apple-touch-icon.png` | 180 × 180 | Apple home-screen icon |
| `public/icons/maskable-512.png` | 512 × 512 | Adaptive OS masks |
| `public/icons/favicon-32.png` | 32 × 32 | Browser favicon |
| `public/icons/favicon-64.png` | 64 × 64 | Higher-density browser favicon |

`public/` above means `apps/client/public/`. The browser links use the rendered
PNG favicons; the old purple SVG is no longer referenced. The install manifest
keeps its established PNG paths. Those images are already included in the PWA
build hash and precache, so replacing the artwork creates a new cache version.

For the maskable icon, the full composition is resampled to 460px and centered
with a 26px navy border on each side. The border color comes from the render's
corner pixel. The critical crown and ball have an estimated maximum radius of
36.6% of the image width under the source framing, within the 40% circular safe
zone. This is a geometric estimate, not an automatic foreground segmentation;
visually review the circle crop before publishing. The decorative plaque/frame
may be cropped by an operating system mask.
