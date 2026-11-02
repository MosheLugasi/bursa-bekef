#!/usr/bin/env python3
"""דירוג מניות לפי שווי שוק (מחקר חד-פעמי, רץ ב-GitHub Actions):
- S&P 500: רשימת החברות מוויקיפדיה + שווי שוק מ-Yahoo → 130 הגדולות
- ת״א: רשימת מועמדות (tase_candidates.json) → אימות סימול + שווי שוק
מדפיס שורות JSON עם קידומת RANK| כדי שיהיה קל לחלץ מהלוג.
"""
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf

HERE = Path(__file__).parent


def mcap(sym):
    try:
        fi = yf.Ticker(sym).fast_info
        mc = fi.get("marketCap") if hasattr(fi, "get") else getattr(fi, "market_cap", None)
        if mc is None:
            mc = getattr(fi, "market_cap", None)
        px = fi.get("lastPrice") if hasattr(fi, "get") else getattr(fi, "last_price", None)
        cur = fi.get("currency") if hasattr(fi, "get") else getattr(fi, "currency", None)
        return sym, float(mc) if mc else None, float(px) if px else None, cur, None
    except Exception as e:  # noqa: BLE001
        return sym, None, None, None, f"{e.__class__.__name__}: {e}"[:160]


def sp500():
    html = requests.get("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies", timeout=60, headers={"User-Agent": "Mozilla/5.0 bursa-bekef research"}).text
    t = pd.read_html(io.StringIO(html))[0]
    rows = [(str(r["Symbol"]).replace(".", "-"), str(r["Security"]), str(r["GICS Sector"]), str(r.get("GICS Sub-Industry", ""))) for _, r in t.iterrows()]
    print("SP500 rows", len(rows), flush=True)
    meta = {s: (n, sec, sub) for s, n, sec, sub in rows}
    with ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(mcap, [r[0] for r in rows]))
    ok = sorted([r for r in res if r[1]], key=lambda r: -r[1])
    print("SP500 with mcap", len(ok), "failed", [r[0] for r in res if not r[1]][:30], flush=True)
    for i, (s, mc, px, cur, _) in enumerate(ok[:130], 1):
        n, sec, sub = meta[s]
        print("RANK|" + json.dumps({"m": "US", "rank": i, "symbol": s, "name": n, "sector": sec, "sub": sub, "mcapB": round(mc / 1e9, 1), "px": px, "cur": cur}, ensure_ascii=False), flush=True)


def tase():
    cands = json.loads((HERE / "tase_candidates.json").read_text(encoding="utf-8"))
    with ThreadPoolExecutor(max_workers=6) as ex:
        res = list(ex.map(mcap, [c[0] for c in cands]))
    by = {c[0]: c for c in cands}
    ok = sorted([r for r in res if r[1]], key=lambda r: -r[1])
    for r in res:
        if not r[1]:
            # בדיקה נוספת: האם יש היסטוריה בכלל
            try:
                h = yf.Ticker(r[0]).history(period="5d")
                hist = len(h)
            except Exception:  # noqa: BLE001
                hist = -1
            print("TFAIL|" + json.dumps({"symbol": r[0], "nameHe": by[r[0]][1], "err": r[4], "hist": hist}, ensure_ascii=False), flush=True)
    for i, (s, mc, px, cur, _) in enumerate(ok, 1):
        c = by[s]
        print("RANK|" + json.dumps({"m": "IL", "rank": i, "symbol": s, "nameHe": c[1], "nameEn": c[2], "sector": c[3], "emoji": c[4], "mcapB": round(mc / 1e9, 2), "px": px, "cur": cur}, ensure_ascii=False), flush=True)
    # השוואה לרשימת ת״א-125 מוויקיפדיה (אם יש טבלה)
    try:
        html = requests.get("https://en.wikipedia.org/wiki/TA-125_Index", timeout=60, headers={"User-Agent": "Mozilla/5.0 bursa-bekef research"}).text
        for k, t in enumerate(pd.read_html(io.StringIO(html))):
            print(f"WIKI-TA125 table {k}: shape={t.shape} cols={list(t.columns)[:6]}", flush=True)
            if t.shape[0] > 50:
                for _, r in t.iterrows():
                    print("WIKI|" + json.dumps({str(c): str(r[c]) for c in t.columns[:5]}, ensure_ascii=False), flush=True)
    except Exception as e:  # noqa: BLE001
        print("WIKI-TA125 error", e, flush=True)


if __name__ == "__main__":
    print("yfinance", yf.__version__)
    tase()
    sp500()
