"""HTTP with an on-disk cache: past data is fetched once, recent data refreshes."""
import hashlib
import os
import tempfile
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

UA = "HailHunter/0.1 (storm-restoration lead research; python-requests)"


class NotFound(Exception):
    pass


class OfflineMiss(Exception):
    pass


class Fetcher:
    def __init__(self, cache_dir, offline=False, timeout=120):
        self.cache_dir, self.offline, self.timeout = cache_dir, offline, timeout
        os.makedirs(cache_dir, exist_ok=True)
        self.s = requests.Session()
        retry = Retry(total=2, backoff_factor=1.5, status_forcelist=(429, 502, 503, 504),
                      allowed_methods=("GET",), raise_on_status=False)
        self.s.mount("https://", HTTPAdapter(max_retries=retry))
        self.s.mount("http://", HTTPAdapter(max_retries=retry))
        self.s.headers["User-Agent"] = UA
        ca = os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE")
        if ca and os.path.exists(ca):
            self.s.verify = ca
        self.stats = {"cache_hits": 0, "fetched": 0, "bytes": 0, "stale_used": 0}

    def path(self, url):
        h = hashlib.sha1(url.encode()).hexdigest()
        return os.path.join(self.cache_dir, h[:2], h)

    def cached(self, url, ttl=None):
        p = self.path(url)
        if not os.path.exists(p):
            return None
        if ttl is not None and not self.offline and time.time() - os.path.getmtime(p) > ttl:
            return None
        with open(p, "rb") as f:
            return f.read()

    def put(self, url, content):
        p = self.path(url)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(p))
        with os.fdopen(fd, "wb") as f:
            f.write(content)
        os.replace(tmp, p)
        with open(p + ".url", "w") as f:
            f.write(url)

    def get(self, url, ttl=None, cache=True):
        c = self.cached(url, ttl) if cache else None
        if c is not None:
            self.stats["cache_hits"] += 1
            return c
        if self.offline:
            raise OfflineMiss(url)
        try:
            r = self.s.get(url, timeout=self.timeout)
            if r.status_code == 404:
                raise NotFound(url)
            r.raise_for_status()
        except NotFound:
            raise
        except Exception:
            stale = self.cached(url, None) if cache else None       # network trouble: fall back to an older copy
            if stale is not None:
                self.stats["stale_used"] += 1
                return stale
            raise
        if cache:
            self.put(url, r.content)
        self.stats["fetched"] += 1
        self.stats["bytes"] += len(r.content)
        return r.content
