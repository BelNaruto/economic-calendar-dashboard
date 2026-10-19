import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_update_data_from_sample(tmp_path):
    out = tmp_path / "events.json"
    subprocess.run([sys.executable, str(ROOT / "scripts/update_data.py"), "--sample",
                    str(ROOT / "tests/sample-events.json"), "--out", str(out)], check=True)
    data = json.loads(out.read_text())
    assert data["count"] == len(data["events"]) > 100
    fed = [e for e in data["events"] if e["event"] == "Fed Interest Rate Decision"]
    assert fed and fed[0]["datetime_utc"].startswith("2026-10-28T18:00")
    assert data["source"].startswith("https://apify.com/pintostudio/")
