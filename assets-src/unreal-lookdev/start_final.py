"""Rebuild the approved studio and render all fourteen 1024 px UI masters."""
import runpy
from pathlib import Path

studio = runpy.run_path(str(Path(__file__).with_name('render_unreal.py')))
studio['main'](preview=False, build=True, resolution=1024, samples=32)
