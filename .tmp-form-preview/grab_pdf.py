import asyncio
import base64
import json
import subprocess
import time
import urllib.request
from pathlib import Path

import fitz
import websockets

root = Path(r"C:\Users\delar\Downloads\PETROSPHERE_PROJECT\Petrosphere-TMS\.tmp-form-preview")
profile = root / "profile"
chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
port = 9342
proc = subprocess.Popen(
    [
        chrome,
        "--headless=new",
        f"--remote-debugging-port={port}",
        f"--user-data-dir={profile}",
        "--disable-gpu",
        "--no-first-run",
        "about:blank",
    ],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1)


async def run():
    tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
    page = next(t for t in tabs if t.get("type") == "page")
    async with websockets.connect(page["webSocketDebuggerUrl"], max_size=80_000_000) as ws:
        n = 0

        async def send(method, params=None, session=None):
            nonlocal n
            n += 1
            msg = {"id": n, "method": method, "params": params or {}}
            if session:
                msg["sessionId"] = session
            await ws.send(json.dumps(msg))
            while True:
                raw = json.loads(await ws.recv())
                if raw.get("id") == n:
                    if raw.get("error"):
                        raise RuntimeError(str(raw["error"]))
                    return raw

        created = await send("Target.createTarget", {"url": "http://localhost:3000/guest/osh-sheet-preview"})
        attached = await send(
            "Target.attachToTarget",
            {"targetId": created["result"]["targetId"], "flatten": True},
        )
        sid = attached["result"]["sessionId"]
        await send("Runtime.enable", session=sid)
        payload = ""
        for _ in range(40):
            ready = await send(
                "Runtime.evaluate",
                {
                    "expression": "window.__pdf ? (window.__pdf.startsWith('ERR') ? window.__pdf : 'ready') : ''",
                    "returnByValue": True,
                },
                session=sid,
            )
            value = ready.get("result", {}).get("result", {}).get("value") or ""
            print("state", value[:200])
            if value.startswith("ERR"):
                return
            if value == "ready":
                got = await send(
                    "Runtime.evaluate",
                    {"expression": "window.__pdf", "returnByValue": True},
                    session=sid,
                )
                payload = got.get("result", {}).get("result", {}).get("value") or ""
                break
            await asyncio.sleep(1)
        if not payload:
            print("no payload")
            return
        dest = root / "sheet.pdf"
        dest.write_bytes(base64.b64decode(payload))
        doc = fitz.open(dest)
        pix = doc[0].get_pixmap(matrix=fitz.Matrix(1.4, 1.4), alpha=False)
        img = root / "p1.png"
        pix.save(img)
        print("pages", doc.page_count, "wrote", img)


try:
    asyncio.run(run())
finally:
    proc.terminate()
