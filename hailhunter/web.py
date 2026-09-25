"""Command center: a phone-friendly local web app on top of the same database the CLI uses.
Dashboard -> door lists (tap-to-log results) -> commercial targets (tap-to-log calls).
No cloud, no accounts: it only listens on your home wifi (data/hailhunter.db is the only state)."""
import json
import socket
from datetime import datetime, timezone

from flask import Flask, g, jsonify, render_template_string, request
from markupsafe import escape as esc

from . import db as dbmod
from . import nbhd
from .commercial import STATUS as COMM_STATUS
from .doors import RESULTS as DOOR_RESULTS

_DB_PATH = None

STAGE_COLOR = {
    # matches the command center page exactly (T4a/T4b, cowork-to-code.md 2026-09-25 (5))
    "No answer": "#666", "Come back": "#8a5a00", "Not interested": "#8a1f1f", "Do not knock": "#8a1f1f",
    "Interested": "#1C5CAB", "Inspection set": "#1C5CAB", "Damage found": "#1C5CAB",
    "Claim filed": "#8a5a00", "Adjuster meeting": "#8a5a00",
    "Approved": "#1a7f37", "Job scheduled": "#1a7f37", "Done": "#1a7f37", "Lost": "#8a1f1f",
    "Not contacted": "#666", "Called": "#666", "Left message": "#666", "Talked to manager": "#1C5CAB",
}
DOOR_PIPELINE = DOOR_RESULTS


def get_db():
    if "conn" not in g:
        g.conn = dbmod.connect(_DB_PATH)
    return g.conn


BASE = """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>{{ title or "HailHunter" }}</title>
<style>
  :root { --blue:#1C5CAB; --bg:#f4f6f9; --card:#fff; --ink:#1b2430; --sub:#6b7684; --line:#e3e7ee; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; padding-bottom:40px; }
  header { background:var(--blue); color:#fff; padding:14px 16px; position:sticky; top:0; z-index:5; }
  header a { color:#fff; text-decoration:none; }
  header h1 { font-size:18px; margin:0; }
  header .sub { font-size:12px; opacity:.85; margin-top:2px; }
  .wrap { padding:12px; max-width:900px; margin:0 auto; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px; margin-bottom:12px; }
  .row { display:flex; justify-content:space-between; align-items:center; gap:10px; }
  .chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
  .chip { background:var(--bg); border:1px solid var(--line); border-radius:20px; padding:6px 12px; font-size:13px; }
  .chip b { color:var(--blue); }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:6px 4px; border-bottom:1px solid var(--line); }
  th { color:var(--sub); font-weight:600; font-size:11px; text-transform:uppercase; }
  .list-link { display:block; padding:12px 4px; border-bottom:1px solid var(--line); text-decoration:none; color:var(--ink); }
  .list-link:last-child { border-bottom:none; }
  .list-link .name { font-weight:600; }
  .list-link .meta { color:var(--sub); font-size:13px; }
  .tag { display:inline-block; font-size:11px; padding:2px 8px; border-radius:10px; color:#fff; }
  .stop { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px; margin-bottom:8px; }
  .stop .addr { font-weight:600; }
  .stop .meta { color:var(--sub); font-size:13px; margin-top:2px; }
  select, input[type=text] { width:100%; padding:8px; margin-top:6px; border:1px solid var(--line); border-radius:8px; font-size:15px; background:#fff; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
  .saved { font-size:12px; color:#1a7f37; margin-left:8px; opacity:0; transition:opacity .2s; }
  .saved.show { opacity:1; }
  .turf-h { position:sticky; top:53px; background:var(--bg); padding:8px 0 4px; font-weight:700; color:var(--blue); z-index:4; }
  a.back { color:#fff; opacity:.9; font-size:13px; }
  .empty { color:var(--sub); padding:20px; text-align:center; }
</style></head><body>
<header><div class="row"><div><a href="/"><h1>&#9906; HailHunter</h1></a><div class="sub">{{ subtitle or "command center" }}</div></div>
{{ back|safe }}</div></header>
<div class="wrap">{{ body|safe }}</div>
<script>
function saveStatus(pid, card){
  const status = card.querySelector('.f-status').value;
  const name = card.querySelector('.f-name').value;
  const phone = card.querySelector('.f-phone').value;
  const notes = card.querySelector('.f-notes').value;
  fetch('/api/status', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({pid, status, contact_name:name, contact_phone:phone, notes})})
    .then(r => r.json()).then(d => {
      const tag = card.querySelector('.tag'); if (tag) { tag.textContent = status || 'New'; }
      const s = card.querySelector('.saved'); s.classList.add('show'); setTimeout(()=>s.classList.remove('show'), 1200);
    });
}
</script>
</body></html>"""


def render(body, title=None, subtitle=None, back=""):
    return render_template_string(BASE, body=body, title=title, subtitle=subtitle, back=back)


def create_app(db_path):
    global _DB_PATH
    _DB_PATH = db_path
    app = Flask(__name__)

    @app.teardown_appcontext
    def _close(exc):
        conn = g.pop("conn", None)
        if conn is not None:
            conn.close()

    @app.route("/")
    def dashboard():
        conn = get_db()
        lists = conn.execute("SELECT * FROM door_lists ORDER BY created_utc DESC").fetchall()
        pipe_rows = conn.execute(
            "SELECT COALESCE(status,'New') status, COUNT(*) n FROM door_status GROUP BY 1").fetchall()
        pipeline = {r["status"]: r["n"] for r in pipe_rows}
        n_commercial = conn.execute("SELECT COUNT(*) n FROM commercial_targets").fetchone()["n"]
        hoods = nbhd.top(conn, limit=8)

        chips = "".join(f'<div class="chip">{k}: <b>{v}</b></div>' for k, v in sorted(pipeline.items()))
        body = f'<div class="card"><div class="row"><b>Pipeline</b><span></span></div>' \
               f'<div class="chips">{chips or "<span style=color:var(--sub)>No doors logged yet</span>"}</div></div>'

        body += '<div class="card"><b>Door lists</b>'
        if not lists:
            body += '<div class="empty">None yet. Run <code>python3 hh.py doors --day ... --near ...</code></div>'
        for l in lists:
            n_done = conn.execute(
                """SELECT COUNT(*) n FROM door_list_stops s JOIN door_status st ON st.pid=s.pid
                   WHERE s.list_id=? AND st.status IS NOT NULL AND st.status<>''""", (l["list_id"],)).fetchone()["n"]
            body += (f'<a class="list-link" href="/list/{l["list_id"]}">'
                     f'<div class="name">{l["area"]} &mdash; {l["conv_day"]}</div>'
                     f'<div class="meta">{l["n_doors"]} doors, {l["n_turfs"]} turfs &middot; {n_done} logged</div></a>')
        body += '</div>'

        body += (f'<a class="list-link card" href="/commercial"><div class="name">Apartments &amp; commercial</div>'
                  f'<div class="meta">{n_commercial} targets</div></a>')

        body += '<div class="card"><b>Best neighborhoods right now</b><table><tr><th>Storm</th><th>Where</th>'\
                '<th>Hail</th><th>Homes</th><th>Score</th></tr>'
        for h in hoods:
            body += (f'<tr><td>{h["conv_day"]}</td><td>{(h["label"] or h["geoid"])[:26]}</td>'
                      f'<td>{h["hail_in"]:.2f}"</td><td>{h["hu"] or "-"}</td><td>{h["score"]:.0f}</td></tr>')
        body += '</table></div>'
        return render(body, "HailHunter", "command center")

    @app.route("/list/<list_id>")
    def door_list(list_id):
        conn = get_db()
        dl = conn.execute("SELECT * FROM door_lists WHERE list_id=?", (list_id,)).fetchone()
        if not dl:
            return render('<div class="empty">List not found.</div>', back='<a class="back" href="/">&larr; back</a>'), 404
        stops = conn.execute(
            """SELECT s.*, st.status, st.contact_name, st.contact_phone, st.notes
               FROM door_list_stops s LEFT JOIN door_status st ON st.pid = s.pid
               WHERE s.list_id=? ORDER BY s.turf, s.stop""", (list_id,)).fetchall()
        opts = "".join(f'<option value="{o}">{o}</option>' for o in DOOR_PIPELINE)
        body, cur_turf = "", None
        for s in stops:
            if s["turf"] != cur_turf:
                cur_turf = s["turf"]
                body += f'<div class="turf-h">Turf {cur_turf}</div>'
            status = s["status"] or ""
            color = STAGE_COLOR.get(status, "#999")
            body += (
                f'<div class="stop" id="pid-{esc(s["pid"])}">'
                f'<div class="row"><span class="addr">{esc(s["address"])}</span>'
                f'<span class="tag" style="background:{color}">{esc(status) or "New"}</span></div>'
                f'<div class="meta">{s["hail_in"]:.2f}" hail &middot; score {s["score"]:.0f}'
                f'{" &middot; " + esc(s["flags"]) if s["flags"] else ""}</div>'
                f'<select class="f-status">{opts}</select>'
                f'<div class="grid2">'
                f'<input class="f-name" type="text" placeholder="Name" value="{esc(s["contact_name"] or "")}">'
                f'<input class="f-phone" type="text" placeholder="Phone" value="{esc(s["contact_phone"] or "")}"></div>'
                f'<input class="f-notes" type="text" placeholder="Notes" value="{esc(s["notes"] or "")}">'
                f'<div class="row"><button onclick="saveStatus(\'{esc(s["pid"])}\', this.closest(\'.stop\'))" '
                f'style="margin-top:8px;background:var(--blue);color:#fff;border:0;border-radius:8px;padding:10px 16px;'
                f'font-size:14px">Save</button><span class="saved">Saved</span></div></div>'
            )
            # pre-select the current status
            body = body.replace(
                f'<option value="{status}">{status}</option>',
                f'<option value="{status}" selected>{status}</option>', 1) if status else body
        return render(body or '<div class="empty">No doors on this list.</div>',
                       dl["area"], dl["conv_day"], back='<a class="back" href="/">&larr; dashboard</a>')

    @app.route("/commercial")
    def commercial_view():
        conn = get_db()
        rows = conn.execute(
            """SELECT c.pid, c.data, st.status, st.contact_name, st.contact_phone, st.notes
               FROM commercial_targets c LEFT JOIN door_status st ON st.pid = c.pid
               ORDER BY json_extract(c.data, '$.score') DESC""").fetchall()
        opts = "".join(f'<option value="{o}">{o}</option>' for o in COMM_STATUS)
        body = ""
        for r in rows:
            b = json.loads(r["data"])
            status = r["status"] or ""
            color = STAGE_COLOR.get(status, "#999")
            owner = b.get("owner") or "owner unknown"
            body += (
                f'<div class="stop" id="pid-{esc(r["pid"])}">'
                f'<div class="row"><span class="addr">{esc(b["address"])}, {esc(b.get("city",""))}</span>'
                f'<span class="tag" style="background:{color}">{esc(status) or "Not contacted"}</span></div>'
                f'<div class="meta">{esc(b.get("kind",""))} &middot; {b["hail_in"]:.2f}" on {b["storm_day"]} '
                f'&middot; score {b["score"]:.0f}<br>{esc(owner)}'
                f'{" &middot; " + esc(b["owner_mail"]) if b.get("owner_mail") else ""}</div>'
                f'<select class="f-status">{opts}</select>'
                f'<div class="grid2">'
                f'<input class="f-name" type="text" placeholder="Contact" value="{esc(r["contact_name"] or "")}">'
                f'<input class="f-phone" type="text" placeholder="Phone" value="{esc(r["contact_phone"] or "")}"></div>'
                f'<input class="f-notes" type="text" placeholder="Notes" value="{esc(r["notes"] or "")}">'
                f'<div class="row"><button onclick="saveStatus(\'{esc(r["pid"])}\', this.closest(\'.stop\'))" '
                f'style="margin-top:8px;background:var(--blue);color:#fff;border:0;border-radius:8px;padding:10px 16px;'
                f'font-size:14px">Save</button><span class="saved">Saved</span></div></div>'
            )
            body = body.replace(
                f'<option value="{status}">{status}</option>',
                f'<option value="{status}" selected>{status}</option>', 1) if status else body
        return render(body or '<div class="empty">None yet. Run <code>python3 hh.py commercial</code></div>',
                       "Apartments & commercial", f"{len(rows)} targets",
                       back='<a class="back" href="/">&larr; dashboard</a>')

    @app.route("/api/status", methods=["POST"])
    def api_status():
        b = request.get_json(force=True) or {}
        pid = b.get("pid")
        if not pid:
            return jsonify(ok=False, error="missing pid"), 400
        conn = get_db()
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """INSERT INTO door_status (pid, status, contact_name, contact_phone, notes, updated_utc)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(pid) DO UPDATE SET status=excluded.status, contact_name=excluded.contact_name,
                 contact_phone=excluded.contact_phone, notes=excluded.notes, updated_utc=excluded.updated_utc""",
            (pid, b.get("status", ""), b.get("contact_name", ""), b.get("contact_phone", ""),
             b.get("notes", ""), now))
        conn.commit()
        return jsonify(ok=True)

    return app


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def run(db_path, port=8420):
    app = create_app(db_path)
    ip = lan_ip()
    print("HailHunter command center running.")
    print(f"  On this Mac  : http://127.0.0.1:{port}")
    print(f"  On your phone (same wifi): http://{ip}:{port}")
    print("  Ctrl+C to stop.")
    app.run(host="0.0.0.0", port=port, threaded=True)
