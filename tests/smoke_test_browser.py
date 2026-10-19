"""Optional end-to-end check: python tests/smoke_test_browser.py (needs `pip install playwright`)."""
import asyncio
import subprocess
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright

SITE = Path(__file__).resolve().parents[1] / "site"


async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8799"], cwd=SITE, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            pg = await b.new_page()
            errors = []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            await pg.goto("http://localhost:8799/?now=2026-10-27T09:00:00Z")
            await pg.wait_for_selector("tbody tr")
            assert not errors, errors
            assert "FOMC" in await pg.locator("#countdowns").inner_text()
            print("OK:", await pg.locator("tbody tr").count(), "rows rendered")
            await b.close()
    finally:
        srv.terminate()


asyncio.run(main())
