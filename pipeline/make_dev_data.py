#!/usr/bin/env python3
"""
יוצר נתוני פיתוח *סינתטיים* (לא אמיתיים!) לצורך פיתוח ובדיקות מקומיות כשאין גישה ל-Yahoo Finance.
מריץ את אותו קוד בדיוק של fetch_data.py, אבל עם yfinance מדומה שמחזיר נתונים בפורמט של Yahoo
(מחירים מתואמים לפיצולים, מניות ת״א באגורות וכו׳). כך נבדקת גם הלוגיקה של עיבוד הנתונים.

האתר שמתפרסם ב-GitHub Pages תמיד משתמש בנתונים אמיתיים (fetch_data.py ב-GitHub Actions).
המניפסט מסומן synthetic=true והאפליקציה מציגה באנר אזהרה.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import random
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_data  # noqa: E402

END = dt.date.today()
SPLITS = {"AAPL": [("2020-08-31", 4.0)], "TSLA": [("2020-08-31", 5.0), ("2022-08-25", 3.0)], "NVDA": [("2021-07-20", 4.0), ("2024-06-10", 10.0)], "AMZN": [("2022-06-06", 20.0)], "GOOGL": [("2022-07-18", 20.0)]}
BASE = {"AAPL": 39, "MSFT": 100, "NVDA": 33, "TSLA": 63, "AMZN": 1500, "GOOGL": 1050, "META": 135, "KO": 46, "SPY": 250, "QQQ": 155}


def seed_for(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


def trading_days(market: str) -> list[dt.date]:
    d = dt.date(2018, 12, 1)
    out = []
    while d <= END:
        wd = d.weekday()  # Mon=0..Sun=6
        if market == "IL" and d < dt.date(2026, 1, 5):
            ok = wd in (6, 0, 1, 2, 3)  # ראשון-חמישי
        else:
            ok = wd < 5
        if ok:
            out.append(d)
        d += dt.timedelta(days=1)
    return out


def covid_shock(d: dt.date) -> float:
    # ירידה חדה במרץ 2020 והתאוששות – כדי שמכונת הזמן תרגיש "אמיתית" בפיתוח
    if dt.date(2020, 2, 20) <= d <= dt.date(2020, 3, 23):
        return -0.012
    if dt.date(2020, 3, 24) <= d <= dt.date(2020, 6, 30):
        return 0.006
    if dt.date(2022, 1, 3) <= d <= dt.date(2022, 10, 12):
        return -0.0012
    return 0.0


class FakeTicker:
    def __init__(self, symbol: str):
        self.symbol = symbol
        self.inst = next((i for i in fetch_data.UNIVERSE["instruments"] if symbol in [i["symbol"], *i.get("altSymbols", [])]), None)

    # ---- מחירים
    def history(self, start=None, auto_adjust=False, actions=True, raise_errors=False):  # noqa: ARG002
        sym = self.symbol
        rnd = random.Random(seed_for(sym))
        if self.inst is None:
            return self._macro()
        market = self.inst["market"]
        days = trading_days(market)
        iid = self.inst["id"]
        p = BASE.get(iid, rnd.uniform(15, 300))
        if market == "IL" and self.inst["type"] == "stock":
            p = rnd.uniform(800, 9000)  # אגורות
        if self.inst.get("indexScale"):
            p = 1500 if iid == "TA35" else 1450
        if iid in ("RBLX",):
            days = [d for d in days if d >= dt.date(2021, 3, 10)]
        if iid in ("MBLY",):
            days = [d for d in days if d >= dt.date(2022, 10, 26)]
        if iid in ("MNDY",):
            days = [d for d in days if d >= dt.date(2021, 6, 10)]
        drift = rnd.uniform(-0.0001, 0.0009)
        vol = rnd.uniform(0.012, 0.03)
        if self.inst["sector"] == "bondfunds":
            vol = 0.004
        rows = []
        for d in days:
            r = drift + covid_shock(d) * (0.2 if self.inst["sector"] == "bondfunds" else 1) + rnd.gauss(0, vol)
            o = p * (1 + rnd.gauss(0, vol / 3))
            p = max(0.5, p * math.exp(r))
            hi = max(o, p) * (1 + abs(rnd.gauss(0, vol / 2)))
            lo = min(o, p) * (1 - abs(rnd.gauss(0, vol / 2)))
            rows.append([d, o, hi, lo, p, int(rnd.uniform(1e5, 5e7))])
        df = pd.DataFrame(rows, columns=["Date", "Open", "High", "Low", "Close", "Volume"])
        # פיצולים: המחירים הגולמיים קופצים מטה ביום הפיצול; Yahoo מחזיר מחירים מתואמים – מחלקים את כל ההיסטוריה שלפני
        df["Stock Splits"] = 0.0
        for sd, ratio in SPLITS.get(iid, []):
            sdd = dt.date.fromisoformat(sd)
            mask_before = df["Date"] < sdd
            # כדי לדמות מחיר גולמי גבוה לפני הפיצול – מכפילים, ואז "מתאמים" חזרה כמו ש-Yahoo עושה
            df.loc[df["Date"] == df.loc[df["Date"] >= sdd, "Date"].min(), "Stock Splits"] = ratio
            _ = mask_before
        df["Dividends"] = 0.0
        if rnd.random() < 0.6 and self.inst["type"] in ("stock", "etf"):
            y = rnd.uniform(0.005, 0.04)
            for i in range(30, len(df), 63):
                df.loc[i, "Dividends"] = round(df.loc[i, "Close"] * y / 4, 4)
        df["Adj Close"] = df["Close"]
        idx = pd.DatetimeIndex([pd.Timestamp(d).tz_localize("America/New_York") for d in df["Date"]])
        df = df.drop(columns=["Date"]).set_index(idx)
        return df

    def _macro(self):
        sym = self.symbol
        days = trading_days("US")
        rnd = random.Random(seed_for(sym))
        vals = []
        if sym == "ILS=X":
            v = 3.6
            for _ in days:
                v = min(4.2, max(3.1, v * math.exp(rnd.gauss(0, 0.004))))
                vals.append(v)
        else:
            base = {"^IRX": 2.3, "^FVX": 2.5, "^TNX": 2.7, "^TYX": 3.0}[sym]
            for d in days:
                # מסלול ריבית בקווים כלליים: נמוך ב-2020-21, עלייה חדה ב-2022, ירידה הדרגתית ב-2024-25
                if d < dt.date(2020, 3, 1):
                    lvl = base
                elif d < dt.date(2022, 1, 1):
                    lvl = 0.1 + (base - 2.0) * 0.6
                elif d < dt.date(2023, 7, 1):
                    frac = (d - dt.date(2022, 1, 1)).days / 546
                    lvl = 0.1 + frac * (5.2 - (2.7 - base) * 0.5)
                else:
                    lvl = 5.2 - (2.7 - base) * 0.5 - (d - dt.date(2023, 7, 1)).days / 1200
                vals.append(max(0.02, lvl + rnd.gauss(0, 0.04)))
        df = pd.DataFrame({"Close": vals}, index=pd.DatetimeIndex([pd.Timestamp(d).tz_localize("America/New_York") for d in days]))
        return df

    @property
    def history_metadata(self):
        if self.inst is None:
            return {"currency": "USD"}
        if self.inst["market"] == "IL" and self.inst["type"] == "stock":
            return {"currency": "ILA"}
        return {"currency": self.inst["currency"]}

    # ---- דוחות
    @property
    def info(self):
        rnd = random.Random(seed_for(self.symbol + "info"))
        cur = "ILS" if self.inst and self.inst["market"] == "IL" else "USD"
        return {
            "sharesOutstanding": int(rnd.uniform(2e8, 1.5e10)) if cur == "USD" else int(rnd.uniform(1e8, 1.5e9)),
            "beta": round(rnd.uniform(0.5, 1.8), 2),
            "fullTimeEmployees": int(rnd.uniform(1000, 200000)),
            "website": "https://example.com",
            "longBusinessSummary": "SYNTHETIC DEV DATA – not a real company description.",
            "sector": "Technology",
            "industry": "Synthetic",
            "financialCurrency": cur,
            "currency": "ILA" if cur == "ILS" else "USD",
        }

    def _stmt(self, rows: dict[str, tuple[float, float]], periods=4, quarterly=False):
        rnd = random.Random(seed_for(self.symbol + str(sorted(rows)) + str(quarterly)))
        cols = []
        y = END.year - 1
        for k in range(periods):
            if quarterly:
                m = 9 - 3 * k
                yy = END.year
                while m <= 0:
                    m += 12
                    yy -= 1
                cols.append(pd.Timestamp(dt.date(yy, m, 28)))
            else:
                cols.append(pd.Timestamp(dt.date(y - k, 12, 31)))
        data = {}
        for name, (lo, hi) in rows.items():
            base = rnd.uniform(lo, hi)
            data[name] = [base * (1 - 0.08 * k + rnd.gauss(0, 0.05)) for k in range(periods)]
        df = pd.DataFrame(data, index=cols).T
        return df

    @property
    def income_stmt(self):
        return self._stmt({"Total Revenue": (5e9, 4e11), "Gross Profit": (2e9, 1.5e11), "Operating Income": (5e8, 1e11), "Net Income": (3e8, 8e10), "Diluted EPS": (0.5, 12), "Diluted Average Shares": (2e8, 1.5e10)})

    @property
    def balance_sheet(self):
        return self._stmt({"Total Assets": (1e10, 5e11), "Total Liabilities Net Minority Interest": (5e9, 3e11), "Stockholders Equity": (5e9, 2e11), "Cash And Cash Equivalents": (1e9, 6e10), "Total Debt": (1e9, 1e11), "Current Assets": (3e9, 1.5e11), "Current Liabilities": (2e9, 1.2e11)})

    @property
    def cashflow(self):
        return self._stmt({"Operating Cash Flow": (5e8, 1e11), "Free Cash Flow": (2e8, 9e10)})

    @property
    def quarterly_income_stmt(self):
        return self._stmt({"Total Revenue": (1e9, 1e11), "Net Income": (1e8, 2e10), "Gross Profit": (5e8, 4e10), "Operating Income": (1e8, 3e10), "Diluted EPS": (0.1, 3)}, periods=5, quarterly=True)

    @property
    def quarterly_balance_sheet(self):
        return self._stmt({"Total Assets": (1e10, 5e11)}, periods=5, quarterly=True)

    @property
    def earnings_history(self):
        rnd = random.Random(seed_for(self.symbol + "eh"))
        idx = [pd.Timestamp(END - dt.timedelta(days=91 * k + 20)) for k in range(4)]
        est = [rnd.uniform(0.5, 3) for _ in idx]
        act = [e * (1 + rnd.gauss(0.03, 0.08)) for e in est]
        return pd.DataFrame({"epsEstimate": est, "epsActual": act, "surprisePercent": [(a / e - 1) for a, e in zip(act, est)]}, index=idx)

    @property
    def news(self):
        if not self.inst:
            return []
        return [
            {
                "id": f"dev-{self.inst['id']}-{k}",
                "content": {
                    "title": f"[DEV] Synthetic headline #{k + 1} about {self.inst['nameEn']}",
                    "summary": "Synthetic development data – not real news.",
                    "pubDate": (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=k * 2)).isoformat(),
                    "provider": {"displayName": "Dev Data"},
                    "canonicalUrl": {"url": "https://example.com"},
                },
            }
            for k in range(2)
        ]


def fake_fred(series: str):
    rnd = random.Random(seed_for(series))
    out = {}
    d = dt.date(2018, 10, 1)
    base = 0.6 if series == "IR3TIB01ILM156N" else 1.9
    while d <= END:
        if d < dt.date(2022, 4, 1):
            v = base * (0.4 if d > dt.date(2020, 3, 1) else 1)
        elif d < dt.date(2023, 6, 1):
            v = base + (d - dt.date(2022, 4, 1)).days / 420 * 3.5
        else:
            v = base + 3.5 - (d - dt.date(2023, 6, 1)).days / 2000
        out[d] = round(v + rnd.gauss(0, 0.05), 3)
        d = dt.date(d.year + (d.month // 12), d.month % 12 + 1, 1)
    return out


def fake_news(inst):
    now = dt.datetime.now(dt.timezone.utc)
    out = []
    for k in range(2):
        he = k == 0
        out.append({
            "id": f"dev-{inst['id']}-{k}",
            "tickers": [inst["id"]],
            "title": f"[פיתוח] כותרת סינתטית על {inst['nameHe']}" if he else f"[DEV] Synthetic headline about {inst['nameEn']}",
            "summary": "",
            "publisher": "Dev Data",
            "url": "https://example.com",
            "time": (now - dt.timedelta(days=k * 2)).isoformat(),
            "lang": "he" if he else "en",
        })
    return out


def main():
    fetch_data.yf.Ticker = FakeTicker  # type: ignore[attr-defined]
    fetch_data.fetch_news = fake_news
    fetch_data.fetch_fred = fake_fred
    fetch_data.time.sleep = lambda *_: None  # type: ignore[assignment]
    sys.argv = [sys.argv[0], "--out", "public/data", "--cache", "/nonexistent-cache"]
    rc = fetch_data.main()
    m = Path("public/data/manifest.json")
    d = json.loads(m.read_text(encoding="utf-8"))
    d["synthetic"] = True
    m.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    print("⚠️  נוצרו נתוני פיתוח סינתטיים (לא אמיתיים) ב-public/data")
    return rc


if __name__ == "__main__":
    sys.exit(main())
