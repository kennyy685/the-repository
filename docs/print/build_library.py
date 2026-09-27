#!/usr/bin/env python3
"""Build the HMP Print Kit page: every print PDF on one screen, tap to read every page (FilthE, 2026-09-27:
"put them all in one screen so I can view them all at once ... I don't want to download them").

    python3 docs/print/build_library.py OUT_DIR

Renders each PDF page to a JPEG (needs `pip install pymupdf`), writes OUT_DIR/print-kit.html plus OUT_DIR/img/*,
and OUT_DIR/files.json (published path -> file) for the Artifact tool's `files`. Re-run it whenever a print piece
changes, then republish to the same artifact URL. A PDF missing from CATALOG still shows up, under "Other".
"""
import glob, html, json, os, sys
from datetime import date

import pymupdf

ROOT = os.path.dirname(os.path.abspath(__file__))

# (file, title, group, note). Order inside a group = order on the page.
CATALOG = [
    ("door-hanger.pdf", "Door hanger: storm", "door", "After hail or wind. English and Spanish."),
    ("door-hanger-everyday.pdf", "Door hanger: everyday", "door", "Older houses, no storm needed."),
    ("homeowner-leave-behind.pdf", "Homeowner leave-behind", "door", "One page to leave after a talk, with the state's consumer hotline."),
    ("neighbor-note.pdf", "Neighbor note", "door", "For the houses around a job."),
    ("business-card.pdf", "Business card", "door", "Kenny and Alex, front and back."),
    ("pocket-card/pocket-card.pdf", "Pocket card", "door", "What to say first, in your pocket."),
    ("walk-sheet.pdf", "Walk sheet", "door", "Paper backup of today's walk for a dead phone."),
    ("first-knock-day.pdf", "First knock day", "door", "The plan for your first day at the doors."),
    ("yard-sign.pdf", "Yard sign", "door", "24 x 18 for every job."),
    ("contingency-agreement.pdf", "Contingency agreement", "legal", "Signed before the adjuster. Draft until the attorney review."),
    ("contingency-agreement-es.pdf", "Acuerdo contingente", "legal", "Spanish version. Draft until the attorney review."),
    ("contract-draft.pdf", "Job contract", "legal", "With the deductible notice and 3-day cancel. Draft until the attorney review."),
    ("contract-draft-es.pdf", "Contrato de trabajo", "legal", "Spanish version. Draft until the attorney review."),
    ("cancel-notice.pdf", "Cancel notice", "legal", "The 3-day cancel form, English and Spanish."),
    ("estimate-sheet.pdf", "Estimate sheet", "legal", "Price range on one page, vinyl vs. Hardie."),
    ("estimate-packet.pdf", "Estimate packet", "legal", "The full itemized estimate."),
    ("siding-scope-sheet.pdf", "Siding scope sheet", "legal", "Everything a siding job includes, so nothing gets missed."),
    ("inspection-checklist.pdf", "Inspection checklist", "claims", "What to check and photograph on the roof and walls."),
    ("inspection-report.pdf", "Inspection report", "claims", "The photo report for the homeowner."),
    ("hail-report.pdf", "Hail report", "claims", "Storm facts for one address."),
    ("claims-101.pdf", "Claims 101", "claims", "How an insurance claim works, for the homeowner."),
    ("adjuster-meeting.pdf", "Adjuster meeting", "claims", "Prep and checklist for meeting the adjuster."),
    ("supplement-checklist.pdf", "Supplement checklist", "claims", "Items insurers often leave out of the first estimate."),
    ("wind-playbook.pdf", "Wind playbook", "claims", "Wind damage: what to look for and say."),
    ("completion-certificate.pdf", "Completion certificate", "claims", "Signed when the job is done."),
    ("capabilities-sheet.pdf", "Capabilities sheet", "commercial", "HMP for contractors and property managers."),
    ("commercial/building-scope-sheet.pdf", "Building scope sheet", "commercial", "Scope per building for apartment jobs."),
    ("commercial/tenant-notice-template.pdf", "Tenant notice", "commercial", "The 24-hour notice a property manager sends each unit."),
    ("vendor-packet/cover.pdf", "Vendor packet cover", "commercial", "Goes on top of the insurance certificate and W-9."),
    ("vendor-packet/lien-waiver-template.pdf", "Lien waiver", "commercial", "Template for property managers and HOAs."),
    ("app-pitch.pdf", "App pitch", "marketing", "The HMP App on one page."),
    ("app-quickstart.pdf", "App quick start", "marketing", "How to use the app on day one."),
    ("community-flyer/option-a.pdf", "Community flyer: Letrero", "marketing", "Color, for boards and the Chamber."),
    ("community-flyer/option-b.pdf", "Community flyer: Boletin", "marketing", "Black and white, for church bulletins."),
    ("pocket-card/option-a.pdf", "Pocket card: option A", "options", "Earlier option, not the final card."),
    ("pocket-card/option-b.pdf", "Pocket card: option B", "options", "Earlier option, not the final card."),
]
GROUPS = [("door", "At the door"), ("legal", "Sale and legal papers"), ("claims", "Inspection and claims"),
          ("commercial", "Commercial and subcontract"), ("marketing", "Marketing and the app"),
          ("options", "Earlier options"), ("other", "Other")]


def slug(path):
    return path[:-4].replace("/", "-")


def render(out):
    os.makedirs(os.path.join(out, "img"), exist_ok=True)
    known = {c[0] for c in CATALOG}
    extra = [(p, os.path.basename(p)[:-4].replace("-", " ").capitalize(), "other", "")
             for p in (os.path.relpath(f, ROOT) for f in sorted(glob.glob(os.path.join(ROOT, "**", "*.pdf"), recursive=True)))
             if p not in known and not p.startswith("library")]
    items, files = [], {}
    for rel, title, group, note in CATALOG + extra:
        src = os.path.join(ROOT, rel)
        if not os.path.exists(src):
            print("missing, skipped:", rel); continue
        doc, s, pages = pymupdf.open(src), slug(rel), []
        for i, page in enumerate(doc):
            zoom = 1100 / page.rect.width
            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
            name = f"img/{s}-p{i + 1}.jpg"
            pix.save(os.path.join(out, name), jpg_quality=74)
            files[name] = os.path.join(out, name)
            pages.append({"src": name, "w": pix.width, "h": pix.height})
            if i == 0:
                z = 460 / page.rect.width
                t = page.get_pixmap(matrix=pymupdf.Matrix(z, z), alpha=False)
                tname = f"img/{s}-thumb.jpg"
                t.save(os.path.join(out, tname), jpg_quality=70)
                files[tname] = os.path.join(out, tname)
        items.append({"id": s, "title": title, "group": group, "note": note, "file": rel, "pages": pages,
                      "thumb": f"img/{s}-thumb.jpg", "es": rel.endswith("-es.pdf") or title.startswith(("Acuerdo", "Contrato")),
                      "draft": "attorney review" in note})
    return items, files


def main():
    out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "print-kit-out")
    items, files = render(out)
    groups = [{"id": g, "name": n} for g, n in GROUPS if any(i["group"] == g for i in items)]
    data = {"items": items, "groups": groups, "built": date.today().strftime("%b %-d, %Y"),
            "pages": sum(len(i["pages"]) for i in items)}
    tpl = open(os.path.join(ROOT, "library_template.html"), encoding="utf-8").read()
    page = tpl.replace("/*DATA*/null", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
    with open(os.path.join(out, "print-kit.html"), "w", encoding="utf-8") as f:
        f.write(page)
    with open(os.path.join(out, "files.json"), "w") as f:
        json.dump(files, f, indent=1)
    size = sum(os.path.getsize(p) for p in files.values())
    print(f"{len(items)} pieces, {data['pages']} pages, {len(files)} images, {size / 1e6:.1f} MB -> {out}")


if __name__ == "__main__":
    main()
