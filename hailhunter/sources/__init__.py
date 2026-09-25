"""Source adapters. Each exposes urls(cfg, start, end, fetcher) -> [(url, ttl, chunk_start)]
and parse(content, cfg) -> [Obs]."""
from datetime import datetime, timedelta, timezone

EPOCH = datetime(2000, 1, 3, tzinfo=timezone.utc)  # a Monday; fixed grid keeps chunk URLs stable


def chunks(start, end, days):
    step = timedelta(days=days)
    s = EPOCH + ((start - EPOCH) // step) * step
    while s < end:
        yield s, s + step
        s += step


def ttl_for(chunk_end, now=None):
    """Seconds before a cached window is re-fetched. None = keep forever."""
    now = now or datetime.now(timezone.utc)
    if chunk_end >= now - timedelta(days=2):
        return 1800            # live window: late reports keep arriving
    if chunk_end >= now - timedelta(days=21):
        return 6 * 3600        # settling: delayed reports / radar archive lag
    return None
