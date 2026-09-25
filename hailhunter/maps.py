"""Hail map picture for one storm day: radar+ground hail, neighborhoods, reports, ranked list."""
import json
import os
from datetime import date

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.colors import BoundaryNorm, ListedColormap  # noqa: E402
from matplotlib.patches import Polygon as MplPolygon  # noqa: E402

from . import nbhd  # noqa: E402

# Sequential single-hue ramp (light -> dark = small -> big hail)
BINS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 9.9]
RAMP = ["#b7d3f6", "#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281", "#0d366b"]
SURFACE, INK, INK2, MUTED, HAIR = "#fcfcfb", "#0b0b0b", "#52514e", "#898781", "#c3c2b7"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9})


def draw(conn, cfg, day, near=None, radius_mi=None, out=None):
    grid, meta, used = nbhd.fused_grid(conn, cfg, day)
    if grid is None:
        raise SystemExit(f"No radar hail map for {day}. Run: python3 hh.py swaths --day {day}")
    hoods = nbhd.top(conn, 200, day=day, min_score=0)
    if near:
        p = conn.execute("SELECT name, state, lat, lon FROM places WHERE lower(name)=lower(?) ORDER BY hu DESC",
                         (near,)).fetchone()
        if not p:
            raise SystemExit(f"Town '{near}' not found")
        clat, clon, title_place = p["lat"], p["lon"], f"{p['name']}, {p['state']}"
    elif hoods:
        clat, clon, title_place = hoods[0]["lat"], hoods[0]["lon"], hoods[0]["place_name"]
    else:
        raise SystemExit("No neighborhoods hit that day")
    radius_mi = radius_mi or (6 if near else 10)
    dlat = radius_mi / 69.05
    dlon = radius_mi / (69.17 * np.cos(np.radians(clat)))
    x0, x1, y0, y1 = clon - dlon, clon + dlon, clat - dlat, clat + dlat

    fig = plt.figure(figsize=(13, 8.6), facecolor=SURFACE)
    ax = fig.add_axes([0.02, 0.08, 0.62, 0.8], facecolor=SURFACE)
    side = fig.add_axes([0.66, 0.08, 0.32, 0.8], facecolor=SURFACE)
    side.axis("off")

    # hail raster
    H, W = grid.shape
    i0 = max(0, int((meta["lat0"] - y1) / meta["dlat"]))
    i1 = min(H, int((meta["lat0"] - y0) / meta["dlat"]) + 2)
    j0 = max(0, int((x0 - meta["lon0"]) / meta["dlon"]))
    j1 = min(W, int((x1 - meta["lon0"]) / meta["dlon"]) + 2)
    sub = np.ma.masked_less(grid[i0:i1, j0:j1], BINS[0])
    ext = [meta["lon0"] + (j0 - 0.5) * meta["dlon"], meta["lon0"] + (j1 - 0.5) * meta["dlon"],
           meta["lat0"] - (i1 - 0.5) * meta["dlat"], meta["lat0"] - (i0 - 0.5) * meta["dlat"]]
    ax.imshow(sub, extent=ext, origin="upper", cmap=ListedColormap(RAMP), norm=BoundaryNorm(BINS, len(RAMP)),
              interpolation="nearest", alpha=0.9, zorder=1)

    # neighborhoods
    hoods = [h for h in hoods if x0 <= h["lon"] <= x1 and y0 <= h["lat"] <= y1]      # only what's on the map
    rank = {h["geoid"]: i for i, h in enumerate(hoods[:10], 1)}
    mi_x = 69.17 * np.cos(np.radians(clat))
    placed = []                                    # label positions (miles) to avoid overlaps
    gap = radius_mi * 0.05

    def free(lon, lat, g=gap):
        return all(((lon - a) * mi_x) ** 2 + ((lat - b) * 69.05) ** 2 > g * g for a, b in placed)
    for g, rings, lat, lon in conn.execute("""SELECT geoid, rings, lat, lon FROM bgs WHERE max_lon>=? AND min_lon<=?
                                              AND max_lat>=? AND min_lat<=?""", (x0, x1, y0, y1)):
        top = g in rank
        for ring in json.loads(rings):
            ax.add_patch(MplPolygon(ring, closed=True, fill=False, lw=1.4 if top else 0.4,
                                    ec=INK if top else HAIR, zorder=3 if top else 2))
        if top:
            tries = 0
            while not free(lon, lat) and tries < 6:
                lat += gap / 69.05
                tries += 1
            placed.append((lon, lat))
            ax.text(lon, lat, str(rank[g]), ha="center", va="center", fontsize=8, fontweight="bold", color=INK,
                    zorder=6, clip_on=True, bbox={"boxstyle": "circle,pad=0.25", "fc": SURFACE, "ec": INK, "lw": 0.8})

    # ground reports
    reps = conn.execute("""SELECT lat, lon, size_in, weight FROM hail_obs WHERE conv_day=? AND kind!='radar'
                           AND dup_of IS NULL AND lon BETWEEN ? AND ? AND lat BETWEEN ? AND ?""",
                        (day, x0, x1, y0, y1)).fetchall()
    for r in reps:
        ax.scatter(r["lon"], r["lat"], s=18 + 40 * r["size_in"], facecolor=SURFACE if r["weight"] >= 0.85 else "none",
                   edgecolor=INK, lw=1.1, zorder=5)
    for r in sorted(reps, key=lambda r: -r["size_in"]):
        if len(placed) >= 16 or not free(r["lon"], r["lat"], gap * 0.8):
            continue
        placed.append((r["lon"], r["lat"]))
        ax.annotate(f'{r["size_in"]:.2f}"', (r["lon"], r["lat"]), xytext=(7, -3), textcoords="offset points",
                    fontsize=7.5, color=INK, zorder=7, bbox={"boxstyle": "round,pad=0.15", "fc": SURFACE,
                                                            "ec": "none", "alpha": 0.8})

    # towns
    for name, lat, lon, hu in conn.execute("""SELECT name, lat, lon, hu FROM places WHERE lon BETWEEN ? AND ?
                                              AND lat BETWEEN ? AND ? AND COALESCE(hu,0) >= 100""", (x0, x1, y0, y1)):
        ax.plot(lon, lat, "s", ms=3, color=INK2, zorder=4)
        ly, tries = lat + radius_mi * 0.0012, 0
        while not free(lon, ly, gap * 0.9) and tries < 8:        # slide the name clear of badges/labels
            ly += gap * 0.6 / 69.05
            tries += 1
        placed.append((lon, ly))
        ax.text(lon, ly, name, fontsize=9 if (hu or 0) > 2000 else 7.5, color=INK2,
                ha="center", va="bottom", zorder=8, fontweight="bold" if (hu or 0) > 2000 else "normal", clip_on=True,
                bbox={"boxstyle": "round,pad=0.12", "fc": SURFACE, "ec": "none", "alpha": 0.75})

    ax.set_xlim(x0, x1)
    ax.set_ylim(y0, y1)
    ax.set_aspect(1 / np.cos(np.radians(clat)))
    ax.set_xticks([])
    ax.set_yticks([])
    for s in ax.spines.values():
        s.set_color(HAIR)
    # scale bar (5 mi)
    sb = 5 / (69.17 * np.cos(np.radians(clat)))
    bx, by = x0 + dlon * 0.08, y0 + dlat * 0.06
    ax.plot([bx, bx + sb], [by, by], color=INK, lw=2, zorder=8)
    ax.text(bx + sb / 2, by + dlat * 0.02, "5 miles", ha="center", fontsize=7.5, color=INK, zorder=8)

    # legend (hail bins + report marker)
    lg = fig.add_axes([0.05, 0.035, 0.38, 0.025])
    for k, c in enumerate(RAMP):
        lg.add_patch(plt.Rectangle((k, 0), 0.94, 1, color=c))
        lab = ['0.75"', '1"', '1.25"', '1.5"', '1.75"', '2"', '2.5"+'][k]
        lg.text(k + 0.47, -0.35, lab, ha="center", va="top", fontsize=7.5, color=INK2)
    lg.set_xlim(0, len(RAMP))
    lg.set_ylim(-1.3, 1)
    lg.axis("off")
    fig.text(0.05, 0.068, "Estimated hail size (radar corrected by ground reports)", fontsize=8, color=INK2)
    lg2 = fig.add_axes([0.46, 0.03, 0.2, 0.05])
    lg2.axis("off")
    lg2.set_xlim(0, 1)
    lg2.set_ylim(0, 1)
    lg2.scatter([0.03], [0.62], s=60, facecolor=SURFACE, edgecolor=INK, lw=1.1)
    lg2.text(0.08, 0.62, "hail report (bigger = bigger hail;\nhollow = app report, less trusted)", va="center",
             fontsize=7.5, color=INK2)
    lg2.text(0.03, 0.08, "1", ha="center", va="center", fontsize=7, fontweight="bold", color=INK,
             bbox={"boxstyle": "circle,pad=0.25", "fc": SURFACE, "ec": INK, "lw": 0.8})
    lg2.text(0.08, 0.08, "top-ranked neighborhood (outlined)", va="center", fontsize=7.5, color=INK2)

    d = date.fromisoformat(day)
    fig.text(0.02, 0.955, f"Hail near {title_place} - storm of {d:%b %d, %Y}", fontsize=15, fontweight="bold",
             color=INK)
    n_view = sum(1 for u in used if x0 <= u["lon"] <= x1 and y0 <= u["lat"] <= y1)
    fig.text(0.02, 0.925, f"NOAA MRMS radar hail, corrected with {n_view} trusted ground report(s) in view. "
             f"Neighborhoods = Census block groups. {radius_mi:g}-mile view.", fontsize=9, color=INK2)

    # ranked list
    side.text(0, 1.0, "Top neighborhoods on this map", fontsize=11, fontweight="bold", color=INK, va="top")
    side.text(0, 0.965, "Hail = typical size across the area; >=1\" = share of area hit", fontsize=7.5,
              color=MUTED, va="top")
    yy = 0.92
    for i, h in enumerate(hoods[:10], 1):
        own = f"{h['owner_share'] * 100:.0f}% own" if h["owner_share"] is not None else ""
        side.text(0, yy, f"{i:>2}", fontsize=9, fontweight="bold", color=INK, va="top")
        side.text(0.07, yy, (h["label"] or h["geoid"])[:40], fontsize=8.5, color=INK, va="top")
        side.text(0.07, yy - 0.028, f'{h["hail_in"]:.2f}" hail  |  {h["frac_ge_1"] * 100:.0f}% >=1"  |  '
                  f'{h["hu"] or 0} homes  |  {own}  |  built {h["med_year"] or "?"}',
                  fontsize=7.5, color=INK2, va="top")
        side.text(1.0, yy, f'{h["score"]:.0f}', fontsize=9, fontweight="bold", color=INK, va="top", ha="right")
        yy -= 0.075
    side.text(1.0, 0.965, "score", fontsize=7.5, color=MUTED, va="top", ha="right")
    days_ago = json.loads(hoods[0]["score_parts"])["days_ago"] if hoods else None
    if days_ago is not None and days_ago > 300:
        side.text(0, yy - 0.01, f"Note: this storm was {days_ago} days ago. Claim deadlines depend on each\n"
                  "homeowner's policy; older storms score lower.", fontsize=7.5, color=INK2, va="top")

    out = out or os.path.join(cfg["paths"]["export"], "maps",
                              f"hail_{day}_{title_place.split(',')[0].replace(' ', '_')}.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fig.savefig(out, dpi=150, facecolor=SURFACE)
    plt.close(fig)
    return out
