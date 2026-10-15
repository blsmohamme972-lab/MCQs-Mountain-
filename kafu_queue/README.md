# Kafu image lessons: ChatGPT writes and draws, Claude narrates

This folder lives only on branch `kafu-queue` of this repository. Builders read it through a read-only worktree; lessons go to
`main` through PRs, as `motioncards/LESSON_PROMPT.md` says.

```
owner: chapter export ──► Head: preflight.py export ──► make_queue.py split (packages of 6)
Head: gpt_writer.py --master ──► master_prompt.html (one fixed prompt, Copy page) ──► owner
owner: export + master prompt ──► ChatGPT writes prompts, 16 per batch (story + characters per set of 8) ──► painter_batchNN.html
owner: each painter card ──► new ChatGPT chat ──► draws ──► the owner's Drive folder (config.json)/<QID>.png
Head: preflight.py images (gate) ──► assign.py split (N slots, N chosen by the owner) ──► N builder sessions (BUILDER.md)
builder: images + export ──► LESSON_PROMPT.md (Breeze) ──► ZIP ──► owner's inbox + phone, PR to main
Head: collect_zips.py ──► preflight.py zips ──► ledger ──► merge_zips.py (≤ 15 MB parts) ──► preflight.py coverage ──► owner ──► @KafuMcqsbot
```

| File | For | What |
|---|---|---|
| `HEAD.md` | Head session | the runbook, stage by stage, and the table of past failures and their prevention |
| `OWNER_AR.md` | owner | the same steps in Iraqi Arabic, only the owner's part |
| `BUILDER.md` | builder sessions | template filled by `assign.py prompt NN` |
| `preflight.py` | Head, builders | gates: `export`, `images`, `zips`, `coverage` |
| `make_queue.py` | Head | `split` the export into packages, `check` them |
| `gpt_writer.py` | Head | `--master`: the fixed ChatGPT prompt (owner attaches the export); `--prefix`: prompts with the questions inside |
| `assign.py` | Head | `split` packages into slots, `prompt` per slot, `left` |
| `watch.py` | all | Drive listing: `status`, `missing`, `get`, `download`; ledger: `state`, `claim`, `deliver`, `fail` |
| `collect_zips.py` | Head | decode and check the base64 ZIPs downloaded from the inbox |
| `merge_zips.py` | Head | merge package ZIPs into parts of at most 15 MB for the bot |
| `config.json` | all | Drive folder (set with `drive.py`), inbox, package size, set size, limits |
| `drive.py` | Head | `set LINK`: the owner's Drive folder for the images; `show` |
| `ledger.json` | all | delivered / failed per package (Head writes it) |

`exports/GET-THROUGH-MRCS-A-SBA-ch36.export.json` is the chapter 36 export (135 questions, already published) and serves as a
test fixture for the scripts.

Notes:
- The Drive folder is read through its "anyone with the link" view; keep that sharing on.
- This repository is public, so queue files and exports here are public (owner's choice).
- Voice engine: Breeze rotation (owner's choice).
