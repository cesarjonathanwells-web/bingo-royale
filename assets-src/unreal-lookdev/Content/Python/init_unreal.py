"""Local file-based editor automation for the dedicated artwork project.

The Python plugin loads this file when this project opens. It executes a request
only when its id changes; requests and logs stay in ignored Saved/Automation.
No network listener or extra Python packages are required.
"""
import json
from pathlib import Path
import time
import traceback

import unreal

ROOT = Path(__file__).resolve().parents[2]
AUTOMATION = ROOT / "Saved" / "Automation"
AUTOMATION.mkdir(parents=True, exist_ok=True)
_last_id = None
_next_poll = 0.0
_namespace = {"__name__": "__main__"}


def _poll(delta):
    global _last_id, _next_poll
    if time.monotonic() < _next_poll:
        return
    _next_poll = time.monotonic() + 1.0
    request_path = AUTOMATION / "request.json"
    if not request_path.exists():
        return
    try:
        request = json.loads(request_path.read_text())
        if request["id"] == _last_id:
            return
        _last_id = request["id"]
        script = Path(request["script"]).resolve()
        if not script.is_relative_to(ROOT):
            raise ValueError("Automation scripts must be inside this lookdev project")
        _namespace["__file__"] = str(script)
        _namespace["REQUEST"] = request
        exec(compile(script.read_text(), str(script), "exec"), _namespace)
        result = {"id": _last_id, "state": "executed", "script": str(script)}
    except Exception:
        result = {"id": _last_id, "state": "error", "traceback": traceback.format_exc()}
        unreal.log_error(result["traceback"])
    (AUTOMATION / "result.json").write_text(json.dumps(result, indent=2))


_handle = unreal.register_slate_post_tick_callback(_poll)
(AUTOMATION / "ready.json").write_text(json.dumps({
    "engine": unreal.SystemLibrary.get_engine_version(),
    "project": str(ROOT),
    "state": "ready",
}, indent=2))
unreal.log("Bingo Royale artwork automation is ready.")
