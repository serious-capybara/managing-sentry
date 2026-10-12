from decimal import Decimal, ROUND_HALF_UP


def round_money(value) -> float:
    """Round to 2 decimals, half away from zero (like PHP round())."""
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


import os
from datetime import datetime, timedelta, timezone

# Timestamps stored WITHOUT a timezone are assumed to be saved in this zone.
# This shop's database stores local Philippine time (UTC+8); treating those values as UTC made new
# entries look 8 hours in the FUTURE. Override with DB_TIMEZONE (e.g. "UTC") if your database differs.
def _naive_tz():
    name = os.getenv("DB_TIMEZONE", "Asia/Manila")
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(name)
    except Exception:  # tzdata missing on the host
        return timezone(timedelta(hours=8)) if name == "Asia/Manila" else timezone.utc


NAIVE_TIMESTAMP_TZ = _naive_tz()


def parse_ts(value):
    """Best-effort parse of a DB timestamp (string or datetime) into an aware datetime."""
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
    """Timestamp -> strict ISO-8601 string with offset, which every browser parses."""
    dt = parse_ts(value)
    return dt.isoformat(timespec="seconds") if dt else (str(value) if value else None)
