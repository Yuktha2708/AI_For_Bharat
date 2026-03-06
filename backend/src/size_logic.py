"""
Size recommendation logic: baseline from size chart, review-based adjustment, confidence.
"""
import re
from typing import Optional, Tuple, Any

# Common size order for "size up" / "size down"
SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL"]


def _parse_size_chart(text: Optional[str]) -> list[dict]:
    """Parse a size chart string into list of {size, measurements}."""
    if not text or not text.strip():
        return []
    rows = []
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for line in lines:
        parts = re.split(r"[\t,|]+", line, maxsplit=5)
        parts = [p.strip() for p in parts if p.strip()]
        if len(parts) >= 2:
            size = parts[0].upper()
            if re.match(r"^(size|chest|waist|hips|bust)$", size, re.I):
                continue  # skip header row
            try:
                def num(s):
                    return float(s.replace('"', "").replace("'", "").strip())
                chest = num(parts[1]) if len(parts) > 1 else None
                waist = num(parts[2]) if len(parts) > 2 else chest
                hips = num(parts[3]) if len(parts) > 3 else waist
                if waist is None:
                    waist = chest
            except (ValueError, TypeError):
                waist, chest, hips = None, None, None
            if waist is not None or chest is not None:
                rows.append({
                    "size": size,
                    "waist": waist or chest,
                    "chest": chest or waist,
                    "hips": hips or waist,
                })
    if rows:
        return rows
    # Fallback: look for "Size M" or "M - 32" patterns
    for line in lines:
        m = re.search(r"(?i)(XXS|XS|S|M|L|XL|XXL|2XL|3XL)\s*[:\-]?\s*([\d.]+)", line)
        if m:
            try:
                num = float(m.group(2))
                rows.append({"size": m.group(1).upper(), "waist": num, "chest": num, "hips": num})
            except ValueError:
                pass
    return rows


def compute_baseline_size(
    size_chart: Optional[str],
    measurements: dict,
    fit_preference: str,
) -> Tuple[Optional[str], bool]:
    """
    Return (baseline_size, chart_parsed).
    measurements: {height, weight, bust, waist, hips} in cm or in.
    """
    rows = _parse_size_chart(size_chart)
    chart_parsed = len(rows) > 0
    if not rows:
        return "M", False
    waist = measurements.get("waist")
    if waist is None:
        waist = measurements.get("hips")
    if waist is None:
        return rows[len(rows) // 2]["size"], True
    best_size = rows[0]["size"]
    best_diff = abs(rows[0].get("waist", rows[0].get("chest", 0)) - waist)
    for row in rows[1:]:
        w = row.get("waist", row.get("chest", 0))
        diff = abs(w - waist)
        if diff < best_diff:
            best_diff = diff
            best_size = row["size"]
    if fit_preference == "snug" and rows:
        idx = next((i for i, r in enumerate(rows) if r["size"] == best_size), 0)
        if idx > 0:
            best_size = rows[idx - 1]["size"]
    elif fit_preference == "relaxed" and rows:
        idx = next((i for i, r in enumerate(rows) if r["size"] == best_size), len(rows) - 1)
        if idx < len(rows) - 1:
            best_size = rows[idx + 1]["size"]
    return best_size, True


def apply_review_adjustment(
    baseline_size: Optional[str],
    chart_parsed: bool,
    fit_signals: dict,
) -> Tuple[str, Optional[str]]:
    """Apply runs_small / runs_large; return (final_size, alternate_size)."""
    verdict = (fit_signals.get("fit_verdict") or "unknown").strip().lower()
    signals = fit_signals.get("signals") or {}
    sizes = SIZE_ORDER
    def size_up(s):
        i = next((idx for idx, x in enumerate(sizes) if x == s), -1)
        return sizes[min(i + 1, len(sizes) - 1)] if i >= 0 else s
    def size_down(s):
        i = next((idx for idx, x in enumerate(sizes) if x == s), -1)
        return sizes[max(i - 1, 0)] if i >= 0 else s
    base = baseline_size or "M"
    if base not in sizes:
        for s in sizes:
            if s in base or base in s:
                base = s
                break
        else:
            base = "M"
    if verdict == "runs_small" or (signals.get("runs_small") or 0) > 0.5:
        final = size_up(base)
        return final, base
    if verdict == "runs_large" or (signals.get("runs_large") or 0) > 0.5:
        final = size_down(base)
        return final, base
    return base, None


def confidence_heuristic(
    has_chart: bool,
    review_count: int,
    fit_signals: dict,
) -> str:
    """Return 'high' | 'medium' | 'low'."""
    verdict = (fit_signals.get("fit_verdict") or "unknown").strip().lower()
    if not has_chart or review_count < 2:
        return "low"
    if verdict in ("mixed", "unknown"):
        return "medium"
    if review_count >= 5:
        return "high"
    return "medium"
