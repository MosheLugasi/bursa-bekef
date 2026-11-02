#!/usr/bin/env python3
"""
איסוף נתוני שוק אמיתיים עבור "בורסה בכיף".

רץ ב-GitHub Actions (יום-יום) ומייצר קבצי JSON סטטיים שהאפליקציה קוראת:
  manifest.json        – מידע כללי (תאריך עדכון, רשימת נכסים)
  closes.json          – מחירי סגירה יומיים לכל הנכסים + מאקרו (דולר, ריביות) על לוח שנה משותף
  prices/<id>.json     – נרות יומיים (פתיחה/גבוה/נמוך/סגירה/מחזור) לכל נכס
  fund/<id>.json       – נתוני דוחות כספיים (שנתי/רבעוני) ומידע על החברה
  news.json            – כותרות חדשות אחרונות (באנגלית) + תקציר בעברית לילדים אם הוגדר ANTHROPIC_API_KEY

המחירים נשמרים "גולמיים" – כלומר לא מתואמים לפיצולי מניות – והפיצולים נשמרים בנפרד.
כך המשחק יכול להראות לילדים פיצול מניות כאירוע אמיתי (מספר המניות בתיק גדל).

שימוש:
  python pipeline/fetch_data.py --out public/data --cache data-cache
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import math
import os
import re
import shutil
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote
import xml.etree.ElementTree as ET

import pandas as pd
import requests
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
UNIVERSE = json.loads((ROOT / "src" / "content" / "universe.json").read_text(encoding="utf-8"))
START = "2019-01-01"
EPOCH = dt.date(1970, 1, 1)


def log(*a):
    print(*a, flush=True)


def epoch_day(d: dt.date) -> int:
    return (d - EPOCH).days


def r2(x):
    """עיגול מחירים: 2 ספרות אחרי הנקודה (4 למחירים קטנים)."""
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return None
    x = float(x)
    if abs(x) < 10:
        return round(x, 4)
    return round(x, 2)


def retry(fn, tries=4, base=3.0, what=""):
    last = None
    for i in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            last = e
            wait = base * (2**i)
            log(f"  ! {what} נכשל ({e.__class__.__name__}: {e}); ניסיון חוזר בעוד {wait:.0f} שניות")
            time.sleep(wait)
    raise last  # type: ignore[misc]


# ---------------------------------------------------------------- מחירים
def fetch_history(symbol: str) -> tuple[pd.DataFrame, str | None]:
    t = yf.Ticker(symbol)
    df = t.history(start=START, auto_adjust=False, actions=True, raise_errors=True)
    if df is None or df.empty:
        raise RuntimeError(f"no data for {symbol}")
    cur = None
    try:
        cur = (t.history_metadata or {}).get("currency")
    except Exception:  # noqa: BLE001
        pass
    return df, cur


def process_instrument(inst: dict) -> dict:
    """מחזיר dict עם סדרות גולמיות: dates, o,h,l,c,v, splits, divs"""
    symbols = [inst["symbol"], *inst.get("altSymbols", [])]
    last_err = None
    for sym in symbols:
        try:
            df, cur = retry(lambda: fetch_history(sym), what=f"{inst['id']} ({sym})")
            break
        except Exception as e:  # noqa: BLE001
            last_err = e
    else:
        raise RuntimeError(f"all symbols failed for {inst['id']}: {last_err}")

    df = df[~df.index.duplicated(keep="last")].sort_index()
    dates = [ts.date() for ts in df.index]

    # יחידות: מניות בת״א מצוטטות באגורות (ILA)
    scale = 1.0
    if cur == "ILA" or (inst["market"] == "IL" and inst["type"] == "stock" and cur in (None, "ILA")):
        scale = 0.01
    if inst.get("indexScale"):
        scale = float(inst["indexScale"])

    splits_raw = df["Stock Splits"] if "Stock Splits" in df else pd.Series(0, index=df.index)
    split_events = [(dates[i], float(r)) for i, r in enumerate(splits_raw.values) if r and r > 0 and r != 1]

    # ביטול התיאום לפיצולים: מחיר גולמי = מחיר מתואם × מכפלת הפיצולים שקרו אחרי התאריך
    n = len(dates)
    factor = [1.0] * n
    f = 1.0
    si = len(split_events) - 1
    for i in range(n - 1, -1, -1):
        while si >= 0 and split_events[si][0] > dates[i]:
            f *= split_events[si][1]
            si -= 1
        factor[i] = f

    def col(name):
        return [None if pd.isna(v) else float(v) for v in df[name].values]

    o, h, l, c, v = col("Open"), col("High"), col("Low"), col("Close"), col("Volume")
    out = {"dates": [], "o": [], "h": [], "l": [], "c": [], "v": []}
    for i in range(n):
        if c[i] is None or c[i] <= 0:
            continue
        k = factor[i] * scale
        oi = o[i] if o[i] and o[i] > 0 else c[i]
        hi = h[i] if h[i] and h[i] > 0 else max(oi, c[i])
        li = l[i] if l[i] and l[i] > 0 else min(oi, c[i])
        out["dates"].append(dates[i])
        out["o"].append(r2(oi * k))
        out["h"].append(r2(max(hi, oi, c[i]) * k))
        out["l"].append(r2(min(li, oi, c[i]) * k))
        out["c"].append(r2(c[i] * k))
        out["v"].append(int(round((v[i] or 0) / factor[i])))

    divs = []
    if "Dividends" in df:
        for i, d in enumerate(df["Dividends"].values):
            if d and d > 0:
                divs.append((dates[i], round(float(d) * factor[i] * scale, 6)))

    # בדיקת שפיות לפיצולים
    for sd, ratio in split_events:
        try:
            j = out["dates"].index(sd)
            if j > 0:
                jump = out["c"][j - 1] / out["c"][j]
                log(f"  ✂ {inst['id']} פיצול {ratio} ב-{sd}: יחס מחירים בפועל {jump:.2f}")
        except ValueError:
            pass

    return {"id": inst["id"], "currency_meta": cur, "splits": split_events, "divs": divs, **out}


# ---------------------------------------------------------------- מאקרו
def fetch_yahoo_close(symbol: str) -> dict[dt.date, float]:
    df = retry(lambda: yf.Ticker(symbol).history(start=START, auto_adjust=False, raise_errors=True), what=symbol)
    return {ts.date(): float(v) for ts, v in df["Close"].items() if not pd.isna(v) and v > 0}


def fetch_fred(series: str) -> dict[dt.date, float]:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}"

    def go():
        # בלי User-Agent מותאם: FRED מאט/חוסם כותרות לא מוכרות מהשרתים של GitHub
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        return r.text

    text = retry(go, what=f"FRED {series}")
    df = pd.read_csv(io.StringIO(text))
    date_col, val_col = df.columns[0], df.columns[1]
    out = {}
    for d, v in zip(df[date_col], df[val_col]):
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        out[dt.date.fromisoformat(str(d)[:10])] = fv
    return out


def fetch_macro() -> dict[str, dict[dt.date, float]]:
    res: dict[str, dict[dt.date, float]] = {}
    for key, m in UNIVERSE["macro"].items():
        series: dict[dt.date, float] = {}
        try:
            if m.get("symbol"):
                series = fetch_yahoo_close(m["symbol"])
                if key.startswith("US") and series:
                    vals = sorted(series.values())
                    med = vals[len(vals) // 2]
                    if med > 20:  # בעבר Yahoo ציטט תשואות ×10
                        series = {d: v / 10 for d, v in series.items()}
        except Exception as e:  # noqa: BLE001
            log(f"  ! מאקרו {key} מ-Yahoo נכשל: {e}")
        if not series and m.get("fred"):
            try:
                series = fetch_fred(m["fred"])
                if key in ("IL10Y", "IL3M"):
                    # נתון חודשי: מתפרסם אחרי סוף החודש – מזיזים לתחילת החודש הבא כדי לא "לראות את העתיד"
                    shifted = {}
                    for d, v in series.items():
                        nm = dt.date(d.year + (d.month // 12), d.month % 12 + 1, 1)
                        shifted[nm] = v
                    series = shifted
            except Exception as e:  # noqa: BLE001
                log(f"  ! מאקרו {key} מ-FRED נכשל: {e}")
        if series:
            res[key] = {d: v for d, v in series.items() if d >= dt.date.fromisoformat(START) - dt.timedelta(days=62)}
            log(f"  ✓ מאקרו {key}: {len(res[key])} נקודות")
    return res


# ---------------------------------------------------------------- דוחות כספיים
FUND_ROWS_INCOME = {
    "revenue": ["Total Revenue", "Operating Revenue"],
    "grossProfit": ["Gross Profit"],
    "operatingIncome": ["Operating Income", "Total Operating Income As Reported"],
    "netIncome": ["Net Income Common Stockholders", "Net Income", "Net Income From Continuing Operation Net Minority Interest"],
    "eps": ["Diluted EPS", "Basic EPS"],
    "shares": ["Diluted Average Shares", "Basic Average Shares"],
}
FUND_ROWS_BALANCE = {
    "totalAssets": ["Total Assets"],
    "totalLiabilities": ["Total Liabilities Net Minority Interest", "Total Liab"],
    "equity": ["Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest"],
    "cash": ["Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"],
    "totalDebt": ["Total Debt"],
    "currentAssets": ["Current Assets"],
    "currentLiabilities": ["Current Liabilities"],
}
FUND_ROWS_CASH = {
    "operatingCashFlow": ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"],
    "freeCashFlow": ["Free Cash Flow"],
}
INFO_KEYS = [
    "sharesOutstanding", "beta", "fullTimeEmployees", "website", "longBusinessSummary", "sector", "industry",
    "financialCurrency", "currency", "country", "city", "trailingEps", "forwardEps", "profitMargins", "grossMargins",
    "operatingMargins", "revenueGrowth", "earningsGrowth", "returnOnEquity", "returnOnAssets", "currentRatio",
    "debtToEquity", "totalCash", "totalDebt", "totalRevenue", "freeCashflow", "longName",
]


def frame_rows(df: pd.DataFrame | None, spec: dict[str, list[str]]) -> list[dict]:
    if df is None or df.empty:
        return []
    out = []
    for colname in df.columns:
        row = {"date": str(pd.Timestamp(colname).date())}
        for key, names in spec.items():
            val = None
            for nm in names:
                if nm in df.index:
                    v = df.loc[nm, colname]
                    if isinstance(v, pd.Series):
                        v = v.iloc[0]
                    if not pd.isna(v):
                        val = float(v)
                        break
            row[key] = val
        out.append(row)
    out.sort(key=lambda r: r["date"])
    return out


def merge_by_date(*lists: list[dict]) -> list[dict]:
    m: dict[str, dict] = {}
    for lst in lists:
        for r in lst:
            m.setdefault(r["date"], {"date": r["date"]}).update({k: v for k, v in r.items() if k != "date"})
    return sorted(m.values(), key=lambda r: r["date"])


def fetch_fundamentals(inst: dict) -> dict:
    t = yf.Ticker(inst["symbol"])
    info = {}
    try:
        raw = retry(lambda: t.info, tries=3, what=f"info {inst['id']}") or {}
        info = {k: raw.get(k) for k in INFO_KEYS if raw.get(k) is not None}
    except Exception as e:  # noqa: BLE001
        log(f"  ! info {inst['id']}: {e}")

    def safe(getter):
        try:
            return getter()
        except Exception:  # noqa: BLE001
            return None

    annual = merge_by_date(
        frame_rows(safe(lambda: t.income_stmt), FUND_ROWS_INCOME),
        frame_rows(safe(lambda: t.balance_sheet), FUND_ROWS_BALANCE),
        frame_rows(safe(lambda: t.cashflow), FUND_ROWS_CASH),
    )
    quarterly = merge_by_date(
        frame_rows(safe(lambda: t.quarterly_income_stmt), FUND_ROWS_INCOME),
        frame_rows(safe(lambda: t.quarterly_balance_sheet), FUND_ROWS_BALANCE),
    )[-6:]
    earnings = []
    eh = safe(lambda: t.earnings_history)
    if eh is not None and not eh.empty:
        for idx, r in eh.iterrows():
            def g(*names):
                for nm in names:
                    if nm in r and not pd.isna(r[nm]):
                        return float(r[nm])
                return None
            earnings.append({
                "date": str(pd.Timestamp(idx).date()),
                "epsEstimate": g("epsEstimate"),
                "epsActual": g("epsActual"),
                "surprisePct": g("surprisePercent"),
            })
    # ILA → ILS בשדות כספיים של info (מניות ת״א)
    if info.get("currency") == "ILA":
        info["currency"] = "ILS"
    if info.get("financialCurrency") == "ILA":
        info["financialCurrency"] = "ILS"
    return {
        "id": inst["id"],
        "updated": dt.date.today().isoformat(),
        "currency": info.get("financialCurrency") or inst["currency"],
        "info": info,
        "annual": annual,
        "quarterly": quarterly,
        "earnings": earnings,
    }


# ---------------------------------------------------------------- חדשות
def _clean_name(name: str) -> str:
    """שם לחיפוש: בלי סוגריים וסימנים (למשל "אלפבית (גוגל)" → "אלפבית")."""
    return re.sub(r"\s*\(.*?\)", "", name).replace("״", "").replace("׳", "").strip()


def _gnews(query: str, lang: str, max_items: int) -> list[dict]:
    if lang == "he":
        url = f"https://news.google.com/rss/search?q={quote(query)}&hl=he&gl=IL&ceid=IL:he"
    else:
        url = f"https://news.google.com/rss/search?q={quote(query)}&hl=en-US&gl=US&ceid=US:en"
    r = requests.get(url, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}")
    out = []
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=30)
    for item in ET.fromstring(r.content).findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        source = (item.findtext("source") or "").strip()
        try:
            when = parsedate_to_datetime(item.findtext("pubDate") or "")
        except (TypeError, ValueError):
            continue
        if not title or when < cutoff:
            continue
        if source and title.endswith(" - " + source):
            title = title[: -len(" - " + source)]
        out.append({"title": title, "url": link, "publisher": source, "time": when.astimezone(dt.timezone.utc).isoformat(), "lang": lang})
    out.sort(key=lambda x: x["time"], reverse=True)
    return out[:max_items]


def fetch_news(inst: dict, english: bool = True) -> list[dict]:
    """כותרות אחרונות מ-Google News: בעברית לכל חברה, ובאנגלית גם לחברות אמריקאיות."""
    queries = [(f"{_clean_name(inst['nameHe'])} מניה", "he", 5)]
    if inst["market"] == "US" and english:
        queries.append((f"{_clean_name(inst['nameEn'])} stock", "en", 3))
    out = []
    for q, lang, n in queries:
        try:
            for it in _gnews(q, lang, n):
                it_id = "g" + hashlib.md5((it["title"] + it["publisher"]).encode("utf-8")).hexdigest()[:16]
                out.append({"id": it_id, "tickers": [inst["id"]], "summary": "", **it})
        except Exception as e:  # noqa: BLE001
            log(f"  ! news {inst['id']} ({lang}): {e}")
        time.sleep(0.4)
    return out


HE_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "titleHe": {"type": "string"},
                    "summaryHe": {"type": "string"},
                    "kidHe": {"type": "string"},
                    "sentiment": {"type": "string", "enum": ["positive", "negative", "neutral"]},
                },
                "required": ["id", "titleHe", "summaryHe", "kidHe", "sentiment"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}

HE_SYSTEM = (
    "אתם עורכי חדשות כלכליות למשחק לימודי בעברית לילדים מגיל 7 ולמבוגרים מתחילים. "
    "לכל ידיעה (באנגלית או בעברית) כתבו: titleHe – כותרת קצרה וברורה בעברית; summaryHe – 1-2 משפטים בעברית פשוטה למבוגר מתחיל; "
    "kidHe – משפט אחד או שניים שילד בן 8 יבין, שמסביר מה קרה ולמה זה יכול להשפיע על מחיר המניה; "
    "sentiment – האם החדשה נשמעת חיובית, שלילית או ניטרלית עבור החברה. "
    "היו מדויקים ונאמנים למקור, אל תמציאו פרטים שלא מופיעים בידיעה, ואל תתנו המלצות השקעה. "
    "פנו בלשון רבים/ניטרלית. החזירו את אותו id שקיבלתם."
)


def translate_news(items: list[dict], cache: dict[str, dict]) -> None:
    key = os.environ.get("ANTHROPIC_API_KEY")
    todo = [it for it in items if it["id"] not in cache]
    if not key or not todo:
        return
    try:
        import anthropic
    except ImportError:
        log("  ! anthropic לא מותקן – מדלגים על תרגום")
        return
    client = anthropic.Anthropic()
    todo = todo[:120]  # תקרה לריצה
    for i in range(0, len(todo), 15):
        batch = todo[i : i + 15]
        payload = [{"id": it["id"], "company": it["tickers"][0], "title": it["title"], "summary": it["summary"][:400]} for it in batch]
        request = dict(
            model="claude-opus-5-5",
            max_tokens=16000,
            system=HE_SYSTEM,
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": HE_SCHEMA}},
            messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
        )
        try:
            try:
                resp = client.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **request)
            except anthropic.BadRequestError:
                resp = client.messages.create(**request)
            if resp.stop_reason == "refusal":
                log("  ! התרגום נדחה עבור קבוצת ידיעות – מדלגים")
                continue
            text = next((b.text for b in resp.content if b.type == "text"), "")
            data = json.loads(text)
            for r in data.get("items", []):
                cache[r["id"]] = {k: r[k] for k in ("titleHe", "summaryHe", "kidHe", "sentiment")}
            log(f"  ✓ תורגמו {len(data.get('items', []))} ידיעות")
        except anthropic.RateLimitError:
            log("  ! מגבלת קצב – עוצרים תרגום לריצה הזו")
            break
        except anthropic.APIError as e:
            log(f"  ! שגיאת API בתרגום: {e}")
        except (json.JSONDecodeError, KeyError) as e:
            log(f"  ! פלט תרגום לא תקין: {e}")


# ---------------------------------------------------------------- main

def encode_series(arr: list) -> dict:
    """קידוד דחוס: מספרים שלמים (×k) כהפרש מהערך הקודם; null נשמר. חוסך כ-50% בגודל הקובץ."""
    vals = [v for v in arr if v is not None]
    # הסקאלה הקטנה ביותר ששומרת על הדיוק (רוב המחירים צריכים רק אגורות/סנטים)
    k = 10000
    for cand in (100, 1000):
        if all(abs(v * cand - round(v * cand)) < 1e-6 for v in vals):
            k = cand
            break
    out, prev = [], None
    for v in arr:
        if v is None:
            out.append(None)
            continue
        iv = int(round(v * k))
        out.append(iv if prev is None else iv - prev)
        prev = iv
    return {"k": k, "d": out}


def decode_series(obj) -> list:
    if isinstance(obj, list):
        return obj
    k, out, prev = obj["k"], [], None
    for x in obj["d"]:
        if x is None:
            out.append(None)
            continue
        prev = x if prev is None else prev + x
        out.append(prev / k)
    return out

def load_json(p: Path, default=None):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return default


def write_json(p: Path, data) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def cached_series(cache: Path, inst_id: str) -> dict | None:
    """טעינת נתוני מחיר מהריצה הקודמת (אם Yahoo נכשל היום)."""
    d = load_json(cache / "prices" / f"{inst_id}.json")
    if not d:
        return None
    ov = load_json(cache / "closes.json", {}) or {}
    splits = [(EPOCH + dt.timedelta(days=s[0]), s[1]) for s in (ov.get("splits", {}).get(inst_id) or [])]
    divs = [(EPOCH + dt.timedelta(days=s[0]), s[1]) for s in (ov.get("divs", {}).get(inst_id) or [])]
    return {
        "id": inst_id,
        "dates": [EPOCH + dt.timedelta(days=t) for t in d["t"]],
        "o": d["o"], "h": d["h"], "l": d["l"], "c": d["c"], "v": d.get("v") or [0] * len(d["t"]),
        "splits": splits, "divs": divs, "fromCache": True,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="public/data")
    ap.add_argument("--cache", default="data-cache")
    ap.add_argument("--fund-days", type=int, default=7, help="כל כמה ימים לרענן דוחות כספיים")
    ap.add_argument("--fund-max", type=int, default=170, help="מקסימום חברות לרענון דוחות בריצה אחת")
    ap.add_argument("--news-rotate", type=int, default=45, help="כמה מניות לא-מרכזיות מקבלות חדשות בכל ריצה")
    ap.add_argument("--only", default="", help="רשימת ids מופרדת בפסיקים (לבדיקות)")
    args = ap.parse_args()
    out = Path(args.out)
    cache = Path(args.cache)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    instruments = UNIVERSE["instruments"]
    if args.only:
        keep = set(args.only.split(","))
        instruments = [i for i in instruments if i["id"] in keep]

    # 1) מחירים
    log(f"== מחירים ({len(instruments)} נכסים) ==")
    results: dict[str, dict] = {}
    failed: list[str] = []

    def work(inst):
        try:
            return inst["id"], process_instrument(inst), None
        except Exception as e:  # noqa: BLE001
            return inst["id"], None, e

    with ThreadPoolExecutor(max_workers=4) as ex:
        for iid, res, err in ex.map(work, instruments):
            if res and res["dates"]:
                results[iid] = res
                log(f"  ✓ {iid}: {len(res['dates'])} ימים, עד {res['dates'][-1]}")
            else:
                cached = cached_series(cache, iid)
                if cached:
                    results[iid] = cached
                    log(f"  ~ {iid}: משתמשים בנתונים מהריצה הקודמת ({err})")
                else:
                    failed.append(iid)
                    log(f"  ✗ {iid}: נכשל ({err})")

    if len(results) < max(3, len(instruments) // 2):
        log("!! יותר מדי נכסים נכשלו – עוצרים כדי לא לפרסם נתונים חסרים")
        return 1

    # 2) מאקרו
    log("== מאקרו ==")
    macro = fetch_macro()
    old_ov = load_json(cache / "closes.json", {}) or {}
    for key in UNIVERSE["macro"]:
        if key not in macro and key in (old_ov.get("s") or {}):
            t = old_ov["t"]
            macro[key] = {EPOCH + dt.timedelta(days=t[i]): v for i, v in enumerate(decode_series(old_ov["s"][key])) if v is not None}
            log(f"  ~ מאקרו {key}: מהריצה הקודמת")

    # 3) לוח שנה משותף
    start = dt.date.fromisoformat(START)
    cal = sorted({d for r in results.values() for d in r["dates"] if d >= start})
    idx = {d: i for i, d in enumerate(cal)}
    n = len(cal)
    s: dict[str, list] = {}
    for iid, r in results.items():
        arr = [None] * n
        for d, c in zip(r["dates"], r["c"]):
            if d in idx:
                arr[idx[d]] = c
        s[iid] = arr
    for key, ser in macro.items():
        arr = [None] * n
        for d, v in sorted(ser.items()):
            # ממקמים כל ערך ביום הלוח הראשון שהוא >= התאריך
            j = _bisect(cal, d)
            if j < n:
                arr[j] = round(v, 4)
        s[key] = arr

    as_of = cal[-1]
    overview = {
        "v": 2,
        "t": [epoch_day(d) for d in cal],
        "s": {key: encode_series(arr) for key, arr in s.items()},
        "splits": {iid: [[epoch_day(d), r_] for d, r_ in r["splits"] if d >= start] for iid, r in results.items() if r["splits"]},
        "divs": {iid: [[epoch_day(d), a] for d, a in r["divs"] if d >= start] for iid, r in results.items() if r["divs"]},
    }
    write_json(out / "closes.json", overview)
    for iid, r in results.items():
        write_json(
            out / "prices" / f"{iid}.json",
            {"id": iid, "t": [epoch_day(d) for d in r["dates"]], "o": r["o"], "h": r["h"], "l": r["l"], "c": r["c"], "v": r["v"]},
        )

    # 4) דוחות כספיים (רענון שבועי)
    log("== דוחות כספיים ==")
    has_fund: set[str] = set()
    today = dt.date.today()
    stocks = [i for i in instruments if i["type"] == "stock" and i["id"] in results]
    prev_fund: dict[str, dict | None] = {i["id"]: load_json(cache / "fund" / f"{i['id']}.json") for i in stocks}

    def age(iid: str) -> int:
        p_ = prev_fund.get(iid)
        if not p_ or not p_.get("updated"):
            return 10_000
        return (today - dt.date.fromisoformat(p_["updated"])).days

    # מרעננים קודם את מה שחסר/ישן ביותר, עם תקרה לריצה (כדי לא לחרוג מזמן הריצה ולא להיחסם)
    stale = sorted([i for i in stocks if age(i["id"]) >= args.fund_days], key=lambda i: -age(i["id"]))[: args.fund_max]
    log(f"  מרעננים {len(stale)} מתוך {len(stocks)} (תקרה {args.fund_max})")

    def fund_work(inst):
        try:
            return inst["id"], fetch_fundamentals(inst), None
        except Exception as e:  # noqa: BLE001
            return inst["id"], None, e

    fresh_fund: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=3) as ex:
        for iid, data, err in ex.map(fund_work, stale):
            if data:
                fresh_fund[iid] = data
                log(f"  ✓ {iid}: {len(data['annual'])} שנים, {len(data['quarterly'])} רבעונים")
            else:
                log(f"  ! {iid}: {err}")
    for inst in stocks:
        data = fresh_fund.get(inst["id"]) or prev_fund.get(inst["id"])
        if data and (data.get("annual") or data.get("info")):
            write_json(out / "fund" / f"{inst['id']}.json", data)
            has_fund.add(inst["id"])

    # 5) חדשות
    log("== חדשות ==")
    news_cache = load_json(cache / "news.json", {}) or {}
    he_cache: dict[str, dict] = load_json(cache / "news-he-cache.json", {}) or {}
    all_items: dict[str, dict] = {it["id"]: it for it in news_cache.get("items", [])}
    # חדשות: המניות ה"מוכרות" (core) בכל יום, ושאר המניות ברוטציה (כמה עשרות ביום) – כדי לא להיחסם
    stock_list = [i for i in instruments if i["type"] == "stock"]
    core = [i for i in stock_list if i.get("core")]
    rest = [i for i in stock_list if not i.get("core")]
    if rest:
        start_ = (dt.date.today().toordinal() * args.news_rotate) % len(rest)
        rest = (rest + rest)[start_ : start_ + args.news_rotate]
    log(f"  חדשות עבור {len(core)} מניות מרכזיות + {len(rest)} ברוטציה")
    for inst in core + rest:
        for it in fetch_news(inst, english=bool(inst.get("core"))):
            if it["id"] in all_items:
                tk = set(all_items[it["id"]]["tickers"]) | set(it["tickers"])
                all_items[it["id"]]["tickers"] = sorted(tk)
            else:
                all_items[it["id"]] = it
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=45)).isoformat()
    items = [it for it in all_items.values() if (it.get("time") or "") >= cutoff[:10]]
    items.sort(key=lambda it: it.get("time") or "", reverse=True)
    items = items[:900]
    try:
        translate_news(items, he_cache)
    except Exception as e:  # noqa: BLE001 – תרגום הוא תוספת; לעולם לא מפיל את עדכון הנתונים
        log(f"  ! תרגום החדשות נכשל: {e}")
    for it in items:
        if it["id"] in he_cache:
            it["he"] = he_cache[it["id"]]
    write_json(out / "news.json", {"items": items})
    he_cache = {k: v for k, v in he_cache.items() if k in {it["id"] for it in items}}
    write_json(out / "news-he-cache.json", he_cache)

    # 6) manifest
    manifest = {
        "version": 1,
        "asOf": as_of.isoformat(),
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "synthetic": False,
        "instruments": [
            {
                "id": iid,
                "first": r["dates"][0].isoformat(),
                "last": r["dates"][-1].isoformat(),
                "hasFund": iid in has_fund,
                "currency": next(i["currency"] for i in UNIVERSE["instruments"] if i["id"] == iid),
            }
            for iid, r in results.items()
        ],
        "macro": sorted(macro.keys()),
        "news": bool(items),
        "newsHe": any("he" in it for it in items),
        "failed": failed,
    }
    write_json(out / "manifest.json", manifest)
    log(f"  חדשות: {len(items)} ידיעות ({sum(1 for it in items if it.get('lang') == 'he')} בעברית)")
    log(f"== סיום: {len(results)} נכסים, נתונים עד {as_of}, נכשלו: {failed or 'אף אחד'} ==")
    return 0


def _bisect(cal: list[dt.date], d: dt.date) -> int:
    lo, hi = 0, len(cal)
    while lo < hi:
        mid = (lo + hi) // 2
        if cal[mid] < d:
            lo = mid + 1
        else:
            hi = mid
    return lo


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        sys.exit(1)
