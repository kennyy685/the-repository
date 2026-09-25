"""Door lists: every home inside a storm's hail zone, hail measured at each house, scored,
and packed into walkable 'turfs' in street-by-street order.

House score (0-100) = 100 x size x recency x distance x age x type x owners x sold
  size     radar+ground hail estimate at the house
  age      year built (older roofs/siding = more damage)
  type     single family 1.0 / duplex-multi 0.8 / mobile home 0.75
  owners   share of owner-occupied homes in the house's Census neighborhood
  sold     0.5 if the house sold AFTER the storm (the claim may belong to the previous owner)
"""
import csv
import json
import os
import re
import string
from collections import defaultdict
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import numpy as np

from . import nbhd, parcels
from .geo import haversine_mi, interp
from .models import iso

KIND_FACTOR = {"single": 1.0, "multi": 0.8, "mobile": 0.75, "farm": 0.6, "commercial": 0.6, "industrial": 0.4}
KIND_LABEL = {"single": "House", "multi": "Multi-family", "mobile": "Mobile home", "farm": "Farm house",
              "commercial": "Commercial", "industrial": "Industrial"}
RESULTS = ["No answer", "Come back", "Not interested", "Do not knock", "Interested", "Inspection set",
           "Damage found", "Claim filed", "Adjuster meeting", "Approved", "Job scheduled", "Done", "Lost"]


# ------------------------------------------------------------------ area + hail at each building
def area_bbox(conn, near, radius_mi=None):
    p = conn.execute("SELECT name, state, lat, lon, aland_sqmi FROM places WHERE lower(name)=lower(?) "
                     "ORDER BY COALESCE(hu,0) DESC", (near,)).fetchone()
    if not p:
        raise SystemExit(f"Town '{near}' not found")
    r = radius_mi or (np.sqrt(max(p["aland_sqmi"] or 1, 0.5) / np.pi) + 2.0)
    dlat, dlon = r / 69.05, r / (69.17 * np.cos(np.radians(p["lat"])))
    return (p["lon"] - dlon, p["lat"] - dlat, p["lon"] + dlon, p["lat"] + dlat), f"{p['name']}, {p['state']}"


def hail_tiles(grid, meta, bbox, min_hail):
    """Parcel tiles inside bbox where the hail grid reached min_hail somewhere."""
    H, W = grid.shape
    keep = []
    for i, j in parcels._tiles(bbox):
        x0, y0, x1, y1 = parcels._tile_box(i, j)
        a0, a1 = max(0, int((meta["lat0"] - y1) / meta["dlat"])), min(H, int((meta["lat0"] - y0) / meta["dlat"]) + 1)
        b0, b1 = max(0, int((x0 - meta["lon0"]) / meta["dlon"])), min(W, int((x1 - meta["lon0"]) / meta["dlon"]) + 1)
        if a1 > a0 and b1 > b0 and float(grid[a0:a1, b0:b1].max()) >= min_hail:
            keep.append((i, j))
    return keep


def _bg_lookup(conn, cfg, meta):
    geoids, offsets, cells = nbhd.cell_index(conn, cfg, meta)
    H, W = meta["shape"]
    idx = np.full(H * W, -1, np.int32)
    for s in range(len(geoids)):
        idx[cells[offsets[s]:offsets[s + 1]]] = s
    own = {}
    for g, o, occ in conn.execute("SELECT geoid, owner, occupied FROM acs WHERE level='bg'"):
        own[g] = (o / occ) if occ else None
    return idx, geoids, own


def score_buildings(conn, cfg, day, bbox, kinds, min_hail, session=None, log=print):
    grid, meta, used = nbhd.fused_grid(conn, cfg, day)
    if grid is None:
        raise SystemExit(f"No radar hail map for {day}. Run: python3 hh.py swaths --day {day}")
    if session is not None:
        tiles = hail_tiles(grid, meta, bbox, min_hail)
        if tiles:
            xs = [parcels._tile_box(i, j) for i, j in tiles]
            parcels.ensure_area(conn, session, (min(t[0] for t in xs), min(t[1] for t in xs),
                                                max(t[2] for t in xs), max(t[3] for t in xs)), log=log)
    x0, y0, x1, y1 = bbox
    rows = conn.execute(f"""SELECT * FROM parcels WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
                            AND kind IN ({','.join('?' * len(kinds))})""", (y0, y1, x0, x1, *kinds)).fetchall()
    H, W = grid.shape
    idx, geoids, own = _bg_lookup(conn, cfg, meta)
    sc, nb, home = cfg["scoring"], cfg["neighborhood"], cfg["home"]
    storm = date.fromisoformat(day)
    today = datetime.now(ZoneInfo(cfg["timezone"])).date()
    R = interp(sc["recency_curve"], (today - storm).days)
    out = []
    for p in rows:
        i = int(round((meta["lat0"] - p["lat"]) / meta["dlat"]))
        j = int(round((p["lon"] - meta["lon0"]) / meta["dlon"]))
        if not (0 <= i < H and 0 <= j < W):
            continue
        hail = float(grid[i, j])
        if hail < min_hail:
            continue
        if p["year_built"] and p["year_built"] > storm.year:
            continue                                          # built after the storm
        bgi = idx[i * W + j]
        share = own.get(geoids[bgi]) if bgi >= 0 else None
        flags = []
        sold = p["sale_date"] and p["sale_date"] > day
        if sold:
            flags.append(f"Sold {p['sale_date']} (after storm)")
        if not p["year_built"]:
            flags.append("Year unknown")
        if p["kind_inferred"]:
            flags.append("Type from zoning")
        if p["kind"] == "multi":
            flags.append("Ask for owner/landlord")
        S = interp(sc["size_curve"], hail)
        dist = haversine_mi(home["lat"], home["lon"], p["lat"], p["lon"])
        D = interp(sc["distance_curve"], dist)
        A = interp(nb["age_curve"], p["year_built"]) if p["year_built"] else nb["age_unknown"]
        O = nb["owner_floor"] + (1 - nb["owner_floor"]) * share if share is not None else nb["owner_unknown"]
        score = 100 * S * R * D * A * KIND_FACTOR.get(p["kind"], 0.5) * O * (0.5 if sold else 1.0)
        out.append({**dict(p), "hail_in": round(hail, 2), "hail_near_in": round(float(grid[max(0, i - 1):i + 2,
                   max(0, j - 1):j + 2].max()), 2), "owner_share": share, "score": round(score, 1),
                    "dist_mi": round(dist, 1),
                    "flags": "; ".join(flags)})
    return out, used


# ------------------------------------------------------------------ walking order
def _serpentine(houses, reverse=False):
    ev = sorted([h for h in houses if h["house_num"] % 2 == 0], key=lambda h: (h["house_num"], h["unit"]))
    od = sorted([h for h in houses if h["house_num"] % 2 == 1], key=lambda h: (h["house_num"], h["unit"]))
    return (ev[::-1] + od) if reverse else (ev + od[::-1])      # up one side, back down the other


def build_turfs(houses, turf_size=60, max_hop_mi=0.4):
    blocks = defaultdict(list)
    for h in houses:
        blocks[(h["street"], h["city"], h["house_num"] // 100)].append(h)
    info = {k: {"key": k, "houses": v, "lat": float(np.mean([h["lat"] for h in v])),
                "lon": float(np.mean([h["lon"] for h in v])), "value": sum(h["score"] for h in v)}
            for k, v in blocks.items()}
    left = set(info)
    turfs = []
    while left:
        seed = max(left, key=lambda k: info[k]["value"])
        path, n = [seed], len(info[seed]["houses"])
        left.discard(seed)
        while n < turf_size and left:
            last = info[path[-1]]
            cand = min(left, key=lambda k: haversine_mi(last["lat"], last["lon"], info[k]["lat"], info[k]["lon"]))
            if haversine_mi(last["lat"], last["lon"], info[cand]["lat"], info[cand]["lon"]) > max_hop_mi:
                # nothing near the end of the path: try near any block already in the turf
                cand = min(left, key=lambda k: min(haversine_mi(info[b]["lat"], info[b]["lon"], info[k]["lat"],
                                                                info[k]["lon"]) for b in path))
                if min(haversine_mi(info[b]["lat"], info[b]["lon"], info[cand]["lat"], info[cand]["lon"])
                       for b in path) > max_hop_mi:
                    break
            path.append(cand)
            left.discard(cand)
            n += len(info[cand]["houses"])
        stops, prev = [], None
        for k in path:                                         # orient each block toward the previous one
            a, b = _serpentine(info[k]["houses"]), _serpentine(info[k]["houses"], reverse=True)
            if prev is not None:
                da = haversine_mi(prev["lat"], prev["lon"], a[0]["lat"], a[0]["lon"])
                db_ = haversine_mi(prev["lat"], prev["lon"], b[0]["lat"], b[0]["lon"])
                a = b if db_ < da else a
            stops += a
            prev = a[-1]
        streets = defaultdict(int)
        for h in stops:
            streets[h["street"]] += 1
        top = [s for s, _ in sorted(streets.items(), key=lambda x: -x[1])[:3]]
        turfs.append({"stops": stops, "doors": len(stops), "value": round(sum(h["score"] for h in stops), 1),
                      "avg_hail": round(float(np.mean([h["hail_in"] for h in stops])), 2),
                      "streets": ", ".join(string.capwords(re.sub(r"\s+", " ", s).lower()) for s in top),
                      "lat": float(np.mean([h["lat"] for h in stops])), "lon": float(np.mean([h["lon"] for h in stops]))})
    turfs.sort(key=lambda t: -t["value"])
    return turfs


# ------------------------------------------------------------------ outputs
COLS = ["Turf", "Stop", "Address", "City", "Zip", "Type", "Built", "Sq ft", "Hail at house (in)", "Flags", "Score",
        "Result", "Name", "Phone", "Notes", "Follow-up", "Lat", "Lon"]


def _stop_row(t, k, h):
    return [t, k, h["address"], h["city"], h["zip"], KIND_LABEL.get(h["kind"], h["kind"]), h["year_built"] or "",
            int(h["sqft"]) if h["sqft"] else "", h["hail_in"], h["flags"], h["score"], "", "", "", "", "",
            h["lat"], h["lon"]]


def write_csv(path, turfs):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(COLS)
        for t, turf in enumerate(turfs, 1):
            for k, h in enumerate(turf["stops"], 1):
                w.writerow(_stop_row(t, k, h))


def write_xlsx(path, turfs, title, subtitle, max_sheets=15):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.datavalidation import DataValidation

    F = "Arial"
    head_fill = PatternFill("solid", fgColor="1C5CAB")
    input_fill = PatternFill("solid", fgColor="FFF7D6")
    thin = Side(style="thin", color="C3C2B7")
    wb = Workbook()
    ws = wb.active
    ws.title = "Summary"
    ws["A1"] = title
    ws["A1"].font = Font(name=F, size=14, bold=True)
    ws["A2"] = subtitle
    ws["A2"].font = Font(name=F, size=10, color="52514E")
    hdr = ["Turf", "Main streets", "Doors", "Avg hail at house (in)", "Turf value", "Knocked", "Leads + inspections",
           "Sheet"]
    for c, v in enumerate(hdr, 1):
        cell = ws.cell(row=4, column=c, value=v)
        cell.font = Font(name=F, bold=True, color="FFFFFF")
        cell.fill = head_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    n_sheets = min(len(turfs), max_sheets)
    for t, turf in enumerate(turfs, 1):
        r = 4 + t
        vals = [t, turf["streets"], turf["doors"], turf["avg_hail"], turf["value"]]
        for c, v in enumerate(vals, 1):
            ws.cell(row=r, column=c, value=v).font = Font(name=F)
        if t <= n_sheets:
            sh = f"'Turf {t}'"
            last = 5 + turf["doors"]
            rc = get_column_letter(COLS[1:16].index("Result") + 1)       # the Result column on turf sheets
            ws.cell(row=r, column=6, value=f"=COUNTA({sh}!{rc}6:{rc}{last})").font = Font(name=F)
            ws.cell(row=r, column=7, value=f'=COUNTIF({sh}!{rc}6:{rc}{last},"Lead")'
                                           f'+COUNTIF({sh}!{rc}6:{rc}{last},"Inspection set")').font = Font(name=F)
            link = ws.cell(row=r, column=8, value=f"Turf {t}")
            link.hyperlink = f"#'Turf {t}'!A1"
            link.font = Font(name=F, color="1C5CAB", underline="single")
        else:
            ws.cell(row=r, column=8, value="see 'All doors'").font = Font(name=F, color="898781")
        ws.cell(row=r, column=4).number_format = '0.00'
    tot = 5 + len(turfs)
    ws.cell(row=tot, column=2, value="Total").font = Font(name=F, bold=True)
    for c in (3, 6, 7):
        col = get_column_letter(c)
        ws.cell(row=tot, column=c, value=f"=SUM({col}5:{col}{tot - 1})").font = Font(name=F, bold=True)
    notes = [
        "HOW TO USE",
        "Each 'Turf' sheet is one walk (about 1-2 hours), already in walking order: up one side of the street, back down the other.",
        "Fill in only the yellow columns: Result (pick from the list), Name, Phone, Notes, Follow-up. The Summary counts update by themselves.",
        "Example: Result = Inspection set | Name = Maria | Phone = 402-555-0100 | Notes = dented gutters, wants Tue 5pm | Follow-up = 6/18",
        "Score = how promising the house is (hail size at the house, how recent, home age, owner-occupied area, distance).",
        "Flag 'Sold ... (after storm)': the new owner may not be able to claim storm damage from before they bought. Ask politely.",
        "RULES: carry your Fremont solicitor permit; skip 'No Soliciting' homes; never promise insurance will pay; the homeowner decides whether to file.",
        "Hail at each house is an estimate (NOAA radar corrected with ground reports, about 1 km detail). Always inspect before quoting.",
        "Addresses: Nebraska Statewide Parcels (county assessors). Hail: NOAA MRMS + NWS storm reports.",
    ]
    for k, txt in enumerate(notes):
        c = ws.cell(row=tot + 2 + k, column=1, value=txt)
        c.font = Font(name=F, bold=(k == 0), size=10, color="0B0B0B" if k == 0 else "52514E")
    for c, wdt in zip("ABCDEFGH", (7, 44, 8, 12, 11, 10, 13, 12)):
        ws.column_dimensions[c].width = wdt
    ws.row_dimensions[4].height = 32
    ws.freeze_panes = "A5"

    def sheet(name, stops_by_turf, title_txt):
        s = wb.create_sheet(name)
        s["A1"] = title_txt
        s["A1"].font = Font(name=F, size=13, bold=True)
        s["A2"] = subtitle
        s["A2"].font = Font(name=F, size=9, color="52514E")
        s["A3"] = "Fill in the yellow columns. Result: " + " / ".join(RESULTS)
        s["A3"].font = Font(name=F, size=9, color="52514E")
        cols = COLS[1:16] if name != "All doors" else COLS
        for c, v in enumerate(cols, 1):
            cell = s.cell(row=5, column=c, value=v)
            cell.font = Font(name=F, bold=True, color="FFFFFF")
            cell.fill = head_fill
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        r = 6
        for t, stops in stops_by_turf:
            for k, h in enumerate(stops, 1):
                row = _stop_row(t, k, h)
                row = row[1:16] if name != "All doors" else row
                for c, v in enumerate(row, 1):
                    cell = s.cell(row=r, column=c, value=v)
                    cell.font = Font(name=F, size=10)
                    cell.border = Border(bottom=thin)
                    if cols[c - 1] in ("Result", "Name", "Phone", "Notes", "Follow-up"):
                        cell.fill = input_fill
                    if cols[c - 1] == "Hail at house (in)":
                        cell.number_format = '0.00'
                r += 1
        rc = get_column_letter(cols.index("Result") + 1)
        dv = DataValidation(type="list", formula1='"' + ",".join(RESULTS) + '"', allow_blank=True)
        dv.add(f"{rc}6:{rc}{max(r - 1, 6)}")
        s.add_data_validation(dv)
        widths = {"Turf": 5, "Stop": 5, "Address": 26, "City": 11, "Zip": 7, "Type": 11, "Built": 6, "Sq ft": 7,
                  "Hail at house (in)": 8, "Flags": 24, "Score": 6, "Result": 14, "Name": 14, "Phone": 13,
                  "Notes": 30, "Follow-up": 10, "Lat": 10, "Lon": 10}
        for c, v in enumerate(cols, 1):
            s.column_dimensions[get_column_letter(c)].width = widths.get(v, 10)
        s.row_dimensions[5].height = 30
        s.freeze_panes = "A6"
        s.print_title_rows = "5:5"
        s.page_setup.orientation = "landscape"
        s.page_setup.fitToWidth = 1
        s.page_setup.fitToHeight = 0
        s.sheet_properties.pageSetUpPr.fitToPage = True
        return s

    for t, turf in enumerate(turfs[:n_sheets], 1):
        sheet(f"Turf {t}", [(t, turf["stops"])], f"Turf {t}: {turf['streets']}  -  {turf['doors']} doors, "
              f"avg hail {turf['avg_hail']:.2f}\"")
    sheet("All doors", [(t, turf["stops"]) for t, turf in enumerate(turfs, 1)], "All doors, every turf")
    wb.save(path)


def _hull(pts):
    pts = sorted(set(map(tuple, pts)))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def draw_turf_map(path, turfs, title, subtitle, conn, max_turfs=15):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.colors import BoundaryNorm, ListedColormap
    from matplotlib.patches import Polygon as MplPolygon
    from .maps import BINS, HAIR, INK, INK2, MUTED, RAMP, SURFACE

    allh = [h for t in turfs for h in t["stops"]]
    lats, lons = np.array([h["lat"] for h in allh]), np.array([h["lon"] for h in allh])
    pad = 0.004
    x0, x1, y0, y1 = lons.min() - pad, lons.max() + pad, lats.min() - pad, lats.max() + pad
    clat = float(lats.mean())
    fig = plt.figure(figsize=(13, 8.6), facecolor=SURFACE)
    ax = fig.add_axes([0.02, 0.07, 0.62, 0.82], facecolor=SURFACE)
    side = fig.add_axes([0.66, 0.07, 0.32, 0.82], facecolor=SURFACE)
    side.axis("off")
    for g, rings in conn.execute("""SELECT geoid, rings FROM bgs WHERE max_lon>=? AND min_lon<=? AND max_lat>=?
                                    AND min_lat<=?""", (x0, x1, y0, y1)):
        for ring in json.loads(rings):
            ax.add_patch(MplPolygon(ring, closed=True, fill=False, lw=0.4, ec=HAIR, zorder=1))
    ax.scatter(lons, lats, s=7, c=[h["hail_in"] for h in allh], cmap=ListedColormap(RAMP),
               norm=BoundaryNorm(BINS, len(RAMP)), lw=0, zorder=3)
    for t, turf in enumerate(turfs[:max_turfs], 1):
        pts = [(h["lon"], h["lat"]) for h in turf["stops"]]
        hull = _hull(pts)
        if len(hull) >= 3:
            ax.add_patch(MplPolygon(hull, closed=True, fill=False, lw=1.2, ec=INK, zorder=4))
        ax.text(turf["lon"], turf["lat"], str(t), ha="center", va="center", fontsize=8, fontweight="bold",
                color=INK, zorder=6, bbox={"boxstyle": "circle,pad=0.25", "fc": SURFACE, "ec": INK, "lw": 0.8})
    ax.set_xlim(x0, x1)
    ax.set_ylim(y0, y1)
    ax.set_aspect(1 / np.cos(np.radians(clat)))
    ax.set_xticks([])
    ax.set_yticks([])
    for s in ax.spines.values():
        s.set_color(HAIR)
    sb = 0.5 / (69.17 * np.cos(np.radians(clat)))
    ax.plot([x0 + (x1 - x0) * 0.05, x0 + (x1 - x0) * 0.05 + sb], [y0 + (y1 - y0) * 0.04] * 2, color=INK, lw=2)
    ax.text(x0 + (x1 - x0) * 0.05 + sb / 2, y0 + (y1 - y0) * 0.055, "half mile", ha="center", fontsize=7.5, color=INK)
    fig.text(0.02, 0.955, title, fontsize=15, fontweight="bold", color=INK)
    fig.text(0.02, 0.925, subtitle, fontsize=9, color=INK2)
    lg = fig.add_axes([0.05, 0.03, 0.38, 0.022])
    for k, c in enumerate(RAMP):
        lg.add_patch(plt.Rectangle((k, 0), 0.94, 1, color=c))
        lg.text(k + 0.47, -0.35, ['0.75"', '1"', '1.25"', '1.5"', '1.75"', '2"', '2.5"+'][k], ha="center", va="top",
                fontsize=7.5, color=INK2)
    lg.set_xlim(0, len(RAMP))
    lg.set_ylim(-1.3, 1)
    lg.axis("off")
    fig.text(0.05, 0.058, "Each dot = one home, colored by estimated hail at that house. Outlines = turfs (walks).",
             fontsize=8, color=INK2)
    side.text(0, 1.0, "Turfs, best first", fontsize=11, fontweight="bold", color=INK, va="top")
    side.text(1.0, 1.0, "doors", fontsize=7.5, color=MUTED, va="top", ha="right")
    yy = 0.955
    for t, turf in enumerate(turfs[:max_turfs], 1):
        side.text(0, yy, f"{t:>2}", fontsize=9, fontweight="bold", color=INK, va="top")
        side.text(0.07, yy, turf["streets"][:44], fontsize=8.3, color=INK, va="top")
        side.text(0.07, yy - 0.024, f'avg hail {turf["avg_hail"]:.2f}"  |  value {turf["value"]:.0f}', fontsize=7.4,
                  color=INK2, va="top")
        side.text(1.0, yy, str(turf["doors"]), fontsize=9, color=INK, va="top", ha="right")
        yy -= 0.061
    if len(turfs) > max_turfs:
        side.text(0, yy, f"+ {len(turfs) - max_turfs} smaller turfs in the spreadsheet", fontsize=8, color=INK2,
                  va="top")
    fig.savefig(path, dpi=150, facecolor=SURFACE)
    plt.close(fig)


def make_list(conn, cfg, day, near, session, radius_mi=None, min_hail=None, turf_size=None, log=print):
    dl = cfg.get("door_lists", {})
    min_hail = min_hail or dl.get("min_hail_in", 1.0)
    turf_size = turf_size or dl.get("turf_size", 60)
    bbox, area = area_bbox(conn, near, radius_mi)
    houses, used = score_buildings(conn, cfg, day, bbox, dl.get("kinds", ["single", "mobile", "multi"]), min_hail,
                                   session, log)
    if not houses:
        return None
    turfs = build_turfs(houses, turf_size, dl.get("max_hop_mi", 0.4))
    d = date.fromisoformat(day)
    slug = f"{day}_{re.sub(r'[^A-Za-z]+', '_', area.split(',')[0])}"
    out = os.path.join(cfg["paths"]["export"], "lists")
    os.makedirs(out, exist_ok=True)
    title = f"Door list - hail of {d:%b %d, %Y} - {area}"
    n_sold = sum(1 for h in houses if "Sold" in h["flags"])
    subtitle = (f"{len(houses):,} homes with an estimated {min_hail:g}\"+ hail at the house, in {len(turfs)} turfs. "
                f"{n_sold} sold after the storm (flagged). Made {datetime.now():%b %d, %Y}.")
    paths = {k: os.path.join(out, f"{slug}.{k}") for k in ("csv", "xlsx", "png")}
    write_csv(paths["csv"], turfs)
    try:
        write_xlsx(paths["xlsx"], turfs, title, subtitle)
    except ImportError:
        log("  openpyxl not installed - skipping .xlsx (csv still written)")
        paths["xlsx"] = None
    try:
        draw_turf_map(paths["png"], turfs, title, subtitle, conn)
    except ImportError:
        log("  matplotlib not installed - skipping map .png")
        paths["png"] = None
    list_id = slug
    conn.execute("INSERT OR REPLACE INTO door_lists VALUES (?,?,?,?,?,?,?,?,?,?)",
                 (list_id, day, area, iso(datetime.now(timezone.utc)),
                  json.dumps({"min_hail": min_hail, "turf_size": turf_size, "bbox": bbox}), len(houses), len(turfs),
                  paths["csv"], paths["xlsx"], paths["png"]))
    conn.execute("DELETE FROM door_list_stops WHERE list_id=?", (list_id,))
    conn.executemany("INSERT INTO door_list_stops VALUES (?,?,?,?,?,?,?,?)",
                     [(list_id, t, k, h["pid"], h["address"], h["hail_in"], h["score"], h["flags"])
                      for t, turf in enumerate(turfs, 1) for k, h in enumerate(turf["stops"], 1)])
    conn.commit()
    return {"list_id": list_id, "houses": houses, "turfs": turfs, "paths": paths, "area": area, "reports": len(used)}
