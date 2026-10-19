"""Refresh site/data/events.json from the Economic Calendar Data (Investing.com) Apify Actor.

    APIFY_TOKEN=... python scripts/update_data.py              # live
    python scripts/update_data.py --sample tests/sample-events.json   # offline
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from econ_client import ACTOR_URL, load_events  # noqa: E402

MAJORS = ["united states", "euro zone", "united kingdom", "japan", "germany", "france", "canada",
          "australia", "new zealand", "switzerland", "china"]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="site/data/events.json")
    ap.add_argument("--sample")
    ap.add_argument("--days-back", type=int, default=7)
    ap.add_argument("--days-ahead", type=int, default=28)
    ap.add_argument("--countries", default=",".join(MAJORS), help="comma list or 'all'")
    args = ap.parse_args(argv)

    countries = None if args.countries == "all" else [c.strip() for c in args.countries.split(",")]
    events = load_events(sample_file=args.sample, days_back=args.days_back, days_ahead=args.days_ahead,
                         countries=countries)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": ACTOR_URL,
        "count": len(events),
        "events": [e.to_dict() for e in events],
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {len(events)} events to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
