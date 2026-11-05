"""Build the studio and render two real Unreal previews."""
import runpy
from pathlib import Path

studio = runpy.run_path(str(Path(__file__).with_name('render_unreal.py')))
studio['main'](preview=True, build=True)
