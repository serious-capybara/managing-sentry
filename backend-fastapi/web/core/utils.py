from decimal import Decimal, ROUND_HALF_UP


def round_money(value) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


import os
from datetime import datetime, timedelta, timezone

def _naive_tz():
    name = os.getenv("DB_TIMEZONE", "Asia/Manila")
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(name)
    except Exception:
        return timezone(timedelta(hours=8)) if name == "Asia/Manila" else timezone.utc


NAIVE_TIMESTAMP_TZ = _naive_tz()


def parse_ts(value):
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=NAIVE_TIMESTAMP_TZ)
    return dt


def iso_ts(value) -> str | None:
    dt = parse_ts(value)
    return dt.isoformat(timespec="seconds") if dt else (str(value) if value else None)
