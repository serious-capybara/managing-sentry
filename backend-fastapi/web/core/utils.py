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


import re as _re

PRODUCT_MARKER = "@product:"
_CLIENT_REF = _re.compile(r"\s*\[(web-[a-z0-9]+)\]")        # old style tag, still understood
_BY_LINE = _re.compile(r"^By .*? \(([0-9A-Z]{12})\)\s*$", _re.M)
_CODE = _re.compile(r"^[0-9A-Z]{12}$")


def clean_client_ref(value):
    """The 12-character 0-9 / A-Z code a client makes for one action, or None if it is not valid."""
    value = str(value or "").strip().upper()
    return value if _CODE.match(value) else None


def by_line(full_name, client_ref=None) -> str:
    """First line of every note: who did it, plus the private code used to spot duplicates."""
    line = f"By {full_name}" if full_name else "By Unknown user"
    code = clean_client_ref(client_ref)
    return f"{line} ({code})" if code else line


def build_audit_notes(full_name, user_notes="", product_name=None, client_ref=None) -> str:
    """Notes saved with a stock movement: the "By ..." line first, then the user's own note and
    (only for removed products) the product name, which no longer exists in the products table."""
    lines = [by_line(full_name, client_ref)]
    if user_notes and str(user_notes).strip():
        lines.append(str(user_notes).strip())
    if product_name:
        lines.append(PRODUCT_MARKER + product_name)
    return "\n".join(lines)


def split_audit_notes(raw):
    """Returns (notes to show, product name stored by build_audit_notes or None)."""
    name = None
    keep = []
    for line in (raw or "").split("\n"):
        if line.startswith(PRODUCT_MARKER):
            name = line[len(PRODUCT_MARKER):].strip() or None
        else:
            keep.append(line)
    return "\n".join(keep).strip(), name


def split_client_ref(raw):
    """Returns (notes, code). The code is read from the "By NAME (CODE)" line and left in place;
    old "[web-...]" tags from earlier versions are removed."""
    text = raw or ""
    match = _BY_LINE.search(text)
    if match:
        return text.strip(), match.group(1)
    legacy = _CLIENT_REF.search(text)
    return _CLIENT_REF.sub("", text).strip(), (legacy.group(1) if legacy else "")
