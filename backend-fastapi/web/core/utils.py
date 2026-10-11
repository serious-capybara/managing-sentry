from decimal import Decimal, ROUND_HALF_UP


def round_money(value) -> float:
    """Round to 2 decimals, half away from zero (like PHP round())."""
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
