"""One overall time guard for `refresh` (Storm Watch runs it in Cowork's cloud with a time limit).

The core steps (hail reports, radar maps, scoring, hud.json) always run. The OPTIONAL network steps (wind reports,
parcel/owner downloads for door lists, everyday lists, Census year-built/language tables, apartment/commercial
downloads) check the guard first: once `refresh.budget_s` (config, default 600 s = 10 min) is used they skip with one
log line, or run from what the database already stores. Each step's time is recorded for refresh_summary.json.
"""
import time
from contextlib import contextmanager


class RunBudget:
    def __init__(self, total_s, clock=time.monotonic, log=print):
        self.total = float(total_s) if total_s else None       # None / 0 = no limit
        self.clock, self.log = clock, log
        self.t0 = clock()
        self.steps, self.skipped = {}, []

    def used(self):
        return self.clock() - self.t0

    def left(self):
        """Seconds left (never below 0), or None without a limit."""
        return None if self.total is None else max(0.0, self.total - self.used())

    def over(self):
        return self.total is not None and self.used() >= self.total

    def cap(self, step_s):
        """A step's own time limit, cut down to what is left of the whole run (None = no limit at all)."""
        left = self.left()
        if left is None:
            return step_s
        return left if step_s is None else min(float(step_s), left)

    def skip(self, name, what="skipped"):
        """True (and one log line) when the budget is used and optional step `name` must not go online."""
        if not self.over():
            return False
        self.skipped.append(name)
        self.log(f"  {name} {what}: refresh time budget used ({self.used() / 60:.1f} of {self.total / 60:g} min)")
        return True

    @contextmanager
    def step(self, name):
        t = self.clock()
        try:
            yield
        finally:
            self.steps[name] = round(self.steps.get(name, 0.0) + self.clock() - t, 1)

    def summary(self):
        return {"total_s": self.total, "used_s": round(self.used(), 1), "skipped": self.skipped,
                "step_s": self.steps}
