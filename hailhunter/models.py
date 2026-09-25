"""The one record type every source is normalized into."""
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone


@dataclass
class Obs:
    uid: str
    source: str          # lsr | swdi | stormevents
    kind: str            # ground (people) | radar | official (NCEI checked record)
    valid_utc: datetime
    lat: float
    lon: float
    size_in: float
    city: str = ""
    county: str = ""
    state: str = ""
    remark: str = ""
    weight: float = 1.0  # how much to trust it, 0..1
    extra: dict = field(default_factory=dict)

    @property
    def conv_day(self):
        """Storm day, 12Z to 12Z (7am-7am CDT), so an evening storm isn't split at midnight."""
        return (self.valid_utc - timedelta(hours=12)).date().isoformat()


def parse_utc(s):
    s = str(s).strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
