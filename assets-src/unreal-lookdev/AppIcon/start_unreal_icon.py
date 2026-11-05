"""Automation entry point; REQUEST.settings may override render quality."""
import importlib.util
from pathlib import Path
import sys

path = Path(__file__).with_name('render_app_icon.py')
spec = importlib.util.spec_from_file_location('bingo_royale_app_icon_studio', path)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
module.main(**globals().get('REQUEST', {}).get('settings', {'resolution': 2048, 'samples': 64}))
