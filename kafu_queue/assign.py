#!/usr/bin/env python3
"""Fixed work split for the builder sessions (Head Department). Builders start only after preflight.py images is OK,
so every package is known in advance and nothing has to be dispatched while they run.

  assign.py split PREFIX N          assignments.json: the packages PREFIX-* in question order, cut into N slots (N = the
                                    number of builder sessions the OWNER chose) with nearly equal question counts, each slot
                                    a run of neighbouring packages. Refuses to overwrite a split that already has deliveries.
  assign.py prompt SLOT --bundle ID the full first message for that slot's builder session (BUILDER.md filled in);
                                    ID = the inbox asset id of the run's bundle (bundle.py pack, then upload it)
  assign.py prompt SLOT --bundle ID --packages P1,P2 [--as NN]
                                    the same for a replacement session: only these packages, under slot name NN
  assign.py left                    per slot: packages not yet delivered in the ledger (what a replacement must do)
  assign.py options PREFIX          the owner's choice table: for several session counts, the time to build everything
                                    once the images exist, and the estimated money per builder model (config.json numbers)
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import watch  # noqa: E402

from kafu_data import ASSIGN as AF, export_path  # noqa: E402
CONFIG = watch.CONFIG


def plan(names, sizes, n):
    """Consecutive packages per slot, balanced by question count (the same split for 'split' and 'options')."""
    total = sum(sizes)
    n = max(1, min(n, len(names)))
    slots, cur, acc, k = {}, [], 0, 1
    for i, (p, s) in enumerate(zip(names, sizes)):
        cur.append(p)
        acc += s
        left_pk, left_slots = len(names) - i - 1, n - k
        if k < n and (acc >= total * k / n or left_pk == left_slots):
            slots[f"{k:02d}"], cur, k = cur, [], k + 1
    if cur:
        slots[f"{k:02d}"] = cur
    return slots


def split(prefix, n):
    from kafu_data import require_data_folder
    require_data_folder()
    pk = {k: v for k, v in watch.packages().items() if k.startswith(prefix + "-")}
    if not pk:
        sys.exit(f"no packages {prefix}-*")
    if AF.exists():
        old = json.loads(AF.read_text())
        led = watch.ledger()
        if any(led.get(p, {}).get("state") == "delivered" for v in old["slots"].values() for p in v):
            sys.exit("assignments.json already has delivered packages; use 'left' and 'prompt --packages' instead")
    names = list(pk)
    sizes = [len(pk[p]["items"]) for p in names]
    total = sum(sizes)
    if n > len(names):
        print(f"note: {n} sessions asked but only {len(names)} packages: using {len(names)}")
    slots = plan(names, sizes, n)
    AF.write_text(json.dumps({"prefix": prefix, "slots": slots}, indent=1) + "\n")
    for s, v in slots.items():
        print(f"slot {s}: {len(v)} packages, {sum(len(pk[p]['items']) for p in v)} questions  {v[0]} .. {v[-1]}")
    assert sorted(p for v in slots.values() for p in v) == sorted(names)
    print(f"{len(names)} packages, {total} questions in {len(slots)} slots")


def prompt(slot, only=None, name=None, bundle=None):
    a = json.loads(AF.read_text())
    pk = watch.packages()
    lst = only or a["slots"][slot]
    for p in lst:
        if p not in pk:
            sys.exit(f"unknown package {p}")
    first = pk[lst[0]]
    rows = []
    for p in lst:
        its = pk[p]["items"]
        rows.append(f"- {p} (export {Path(pk[p]['export']).name}): questions {', '.join(str(i.get('number')) for i in its)}; "
                    f"QIDs {' '.join(i['qid'] for i in its)}")
    exports = sorted({pk[p]["export"] for p in lst})
    vals = {
        "@@SLOT@@": name or slot, "@@REPO_SLUG@@": CONFIG["repo_slug"], "@@NQ@@": str(sum(len(pk[p]["items"]) for p in lst)),
        "@@CHAPTER@@": "; ".join(sorted({f"{pk[p].get('book_id', '')} chapter {pk[p].get('chapter_id', '')}: {pk[p].get('chapter_title', '')}"
                                         for p in lst})),
        "@@PKG_TABLE@@": "\n".join(rows), "@@QUEUE_BRANCH@@": CONFIG["queue_branch"],
        "@@EXPORT_CP@@": " ".join(f"work/kq-data/exports/{Path(e).name}" for e in exports),
        "@@EXPORT_CHECK@@": " && ".join(f"KAFU_MOUNTAIN=$PWD python3 /home/user/kq/kafu_queue/preflight.py export work/input/{Path(e).name} | tail -n 1"
                                        for e in exports), "@@ALREADY_LIVE@@": "yes" if first.get("already_live") else "no",
        "@@MAX_MB@@": str(CONFIG["max_package_zip_mb"]), "@@INBOX@@": CONFIG["zip_inbox_url"], "@@NPKG@@": str(len(lst)),
        "@@BUNDLE@@": bundle or "<BUNDLE ASSET ID>", "@@PKG_LIST@@": ",".join(lst),
    }
    text = (HERE / "BUILDER.md").read_text()
    for k, v in vals.items():
        text = text.replace(k, v)
    if "@@" in text:
        sys.exit("unfilled placeholder in BUILDER.md")
    print(text)


def options(prefix, counts=(1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 60)):
    pk = {k: v for k, v in watch.packages().items() if k.startswith(prefix + "-")}
    if not pk:
        sys.exit(f"no packages {prefix}-*")
    names = list(pk)
    sizes = [len(pk[p]["items"]) for p in names]
    nq, npk = sum(sizes), len(names)
    mpq = CONFIG["minutes_per_question"]
    models = CONFIG["builder_cost_usd"]
    head = sum(CONFIG["head_cost_usd"].values())
    print(f"{nq} questions in {npk} packages; build speed {mpq} min per question per session (measured); "
          f"Head (Opus) about ${head:.0f} per run. Money figures are estimates; waiting for images adds about "
          + ", ".join(f"${v['per_hour']:.2f} ({m})" for m, v in models.items()) + " per session per hour.")
    print("sessions | hours after the images exist | " + " | ".join(f"$ {m}" for m in models))
    size = dict(zip(names, sizes))
    busiest = {n: max(sum(size[p] for p in v) for v in plan(names, sizes, n).values()) for n in range(1, npk + 1)}
    asked = [c for c in counts if c <= npk] + ([npk] if npk <= max(counts) else [])
    # each count is lowered to the fewest sessions that finish as early: more sessions would only cost more
    rows = sorted({min(m for m in range(1, c + 1) if busiest[m] <= busiest[c]) for c in asked})
    # a slot longer than 12 hours is not offered: one lost container would cost too much, and waiting for images needs
    # room inside autobuild's 16-hour limit (if every count is longer, only the fastest is shown)
    rows = [n for n in rows if busiest[n] * mpq / 60 <= 12] or rows[-1:]
    for n in rows:
        hours = busiest[n] * mpq / 60                       # the busiest slot decides the finish
        cost = [n * v["session"] + nq * mpq / 60 * v["per_hour"] + npk * v["per_package"] for v in models.values()]
        print(f"{n:>8} | {hours:>6.1f} | " + " | ".join(f"{x:>6.2f}" for x in cost))


def left():
    if not AF.exists():
        sys.exit(f"no slot split in {AF}: run assign.py split first (Head only)")
    a = json.loads(AF.read_text())
    led = watch.ledger()
    n = 0
    for s, v in a["slots"].items():
        todo = [p for p in v if led.get(p, {}).get("state") != "delivered"]
        n += len(todo)
        print(f"slot {s}: {len(v) - len(todo)}/{len(v)} delivered" + (f"; left: {','.join(todo)}" if todo else ""))
    print(f"packages left: {n}")


def main(a):
    if not a:
        sys.exit(__doc__)
    if a[0] == "split":
        if len(a) < 3:
            sys.exit("assign.py split PREFIX N: N is the number of sessions the owner chose")
        split(a[1], int(a[2]))
    elif a[0] == "prompt":
        only = a[a.index("--packages") + 1].split(",") if "--packages" in a else None
        name = a[a.index("--as") + 1] if "--as" in a else None
        bundle = a[a.index("--bundle") + 1] if "--bundle" in a else None
        if not bundle:
            sys.exit("--bundle <asset id> is required: bundle.py pack, upload it to the inbox, then pass its asset id")
        prompt(a[1], only, name, bundle)
    elif a[0] == "left":
        left()
    elif a[0] == "options":
        options(a[1])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
