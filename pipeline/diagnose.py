#!/usr/bin/env python3
"""בדיקת מקורות נתונים (להרצה ידנית ב-GitHub Actions: Actions → בדיקת מקורות נתונים → Run workflow).
שימוש: python pipeline/diagnose.py --symbols "DELG.TA,AAPL" --news "AAPL,TEVA.TA" --fred "IRLTLT01ILM156N"
"""
import argparse
import json

import requests
import yfinance as yf

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}

ap = argparse.ArgumentParser()
ap.add_argument("--symbols", default="")
ap.add_argument("--news", default="")
ap.add_argument("--fred", default="")
a = ap.parse_args()
print("yfinance", yf.__version__)

for s in filter(None, a.symbols.split(",")):
    try:
        df = yf.Ticker(s).history(period="1mo", auto_adjust=False)
        print(f"[price] {s}: rows={len(df)} last={df.index[-1].date() if len(df) else None} close={df['Close'].iloc[-1] if len(df) else None}")
    except Exception as e:  # noqa: BLE001
        print(f"[price] {s}: ERROR {e.__class__.__name__}: {e}")

for s in filter(None, a.news.split(",")):
    t = yf.Ticker(s)
    for label, fn in [("news", lambda: t.news), ("get_news", lambda: t.get_news(count=10, tab="news") if hasattr(t, "get_news") else "n/a")]:
        try:
            items = fn()
            n = len(items) if isinstance(items, list) else items
            print(f"[news] {s} {label}: {n}")
            if isinstance(items, list) and items:
                print("   first item:", json.dumps(items[0], ensure_ascii=False, default=str)[:700])
        except Exception as e:  # noqa: BLE001
            print(f"[news] {s} {label}: ERROR {e.__class__.__name__}: {e}")

for sid in filter(None, a.fred.split(",")):
    for url in [f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}", f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}&cosd=2018-01-01"]:
        for hdr_name, hdr in [("browser-UA", UA), ("default-UA", {})]:
            try:
                r = requests.get(url, headers=hdr, timeout=25)
                lines = r.text.strip().splitlines()
                print(f"[fred] {sid} {hdr_name} {'range' if 'cosd' in url else 'full'}: HTTP {r.status_code} lines={len(lines)} head={lines[:2]} tail={lines[-1:]}")
            except Exception as e:  # noqa: BLE001
                print(f"[fred] {sid} {hdr_name}: ERROR {e.__class__.__name__}: {e}")
