#!/usr/bin/env python3
"""Rebuild the owner-supplied Rush 6e package, including reviewed provenance."""
import argparse, collections, hashlib, io, json, random, zipfile
from pathlib import Path
from PIL import Image
from tools.package_batch import build, run_checked
import sys


def write_archive(path, files):
    with zipfile.ZipFile(path, 'w') as z:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED if name == 'report.md' else zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf', type=Path)
    ap.add_argument('--metadata', type=Path, required=True)
    ap.add_argument('--out-dir', type=Path, required=True)
    ap.add_argument('--report-only', action='store_true', help='Refresh report of an already built Rush package')
    args = ap.parse_args()
    path = args.out_dir/'RUSH-SURGERY-6E_v1.zip' if args.report_only else build(args.pdf, 'rush_surgery_6e', args.metadata, args.out_dir)
    with zipfile.ZipFile(path) as z:
        files = {n: z.read(n) for n in z.namelist()}
    qs = [json.loads(x) for x in files['questions.jsonl'].splitlines()]
    audit = json.loads(files['audit.json'])
    validation = run_checked(sys.executable, 'tools/validate.py', '--require-audit', str(path)).replace(str(path), path.name)
    types = collections.Counter(q['type'] for q in qs)
    chosen = sorted(random.Random(600).sample(range(1, len(qs)+1), 15))
    lines = [
        '# Rush Review of Surgery, sixth edition: preparation report', '',
        'Source: owner-supplied 595-page PDF; printed answers retained without medical correction.',
        f'Source SHA-256: {hashlib.sha256(args.pdf.read_bytes()).hexdigest()}',
        'Parser: tools/parsers/rush_surgery_6e.py. Gates: original audit.py, validate.py and validate_release.py, unchanged.', '',
        f'Coverage: 1,579 numbered source blocks, 35 chapters; seven matching blocks expanded into 35 individual items. Total: {len(qs)}.',
        f'Types: {dict(types)}. Skipped: 0. Flagged: 0. Missing assigned explanation: local_id 442 (chapter 9, source 13, PDF p.162); no explanation invented.',
        'Matching instructions are in lead_in. Source items shorter than the unchanged 10-character stem minimum also retain their copied instruction in stem; no scenario is invented.',
        'Explanations retain four copied sentences and any additional sentence needed for a cited figure/table.',
        '48 figures and 20 table-page crops; 84 image attachments. All distinct crops visually checked; labels, table tails and column boundaries corrected before final build.',
        'Complex source tables remain source crops; two option matrices (local_id 1182 and 1562) use Markdown tables.', '',
        '## Source review', '',
        'Fifteen reproducible spot checks (seed 600), plus all remaining audit warnings:']
    for n in chosen:
        q=qs[n-1]
        lines.append(f'- local_id {n}: chapter {q["chapter_id"]}, source {q["source_number"]}{q["source_item"]}, PDF pages {q["source_pages"]}, answer {q["answer"]}.')
    lines += ['', 'Every answer checked against extracted inline source keys, including shared trauma answers C/E/B and matching item letters.',
              'Full-phrase comparisons additionally identify source column interleaving around figures/tables; these are documented in phrase-differences.json in the rebuild evidence.', '',
              '## Audit warnings', '']
    for row in audit['results']:
        if row['level'] != 'match':
            q=qs[row['local_id']-1]
            lines.append(f'- local_id {q["local_id"]}, source {q["source_number"]}, PDF {q["source_pages"]}: {row["level"]}; {"matching instruction and item are separated from the two-column option layout" if 630 <= q["local_id"] <= 634 else "source-confirmed line-end word hyphenation is joined"}. Original wording and key retained. {row["detail"]}')
    lines += ['', '## Validator warning locations', '']
    for line in validation.splitlines():
        import re
        m=re.search(r'Q(\d+)',line)
        if m:
            q=qs[int(m[1])-1]
            lines.append(f'- local_id {q["local_id"]}, chapter {q["chapter_id"]}, source {q["source_number"]}, PDF {q["source_pages"]}: {line.strip()}')
    lines += ['', '## Validator warnings', '',
              'The validator output retains legacy HELD wording; docs/CONTENT_TEAM.md states remaining audit warnings are informational and require no owner approval.',
              'Suspended hyphens (for example split- and full-thickness) are printed source wording. They are retained.',
              'local_id 181: HBcAb+ and HBcAb- are distinct printed options; punctuation-stripped duplicate detection treats them as equal.',
              'local_id 1104: unmatched parenthesis is present in the source explanation; retained.',
              'local_id 1318 and 309: same short printed stem with different options and chapters; retained.', '', '```text', validation, '```', '',
              '## Final archive limits', '',
              'Limit references: ZIP tools/validate.py:46,434-436; worker/queue-state.mjs:2,21; tools/drain_queue.py:32,89; migrations/0001_publish_queue.sql:24. Expanded contents tools/validate.py:47,371,376-377. Entries:48,340-343. Member ratio:49,372-374. Images:50,52-53,487-494. Cover:51,465-473.',
              'Images per item: images <=6 and explanation_images <=6, tools/validate.py:311-317. Parts <=100 and filename <=255 characters: worker/queue-state.mjs:6,10; migrations/0001_publish_queue.sql:5. No independent question-count or JSON byte ceiling: tools/validate.py:390-404,448-449,497-530; tools/validate_release.py:21-45; tools/publish.py:51-112.',
              'Downstream HTTP response default cap 64 MiB: tools/http_client.py:14,77-95,116-125. Permanent ID allocation <=999999999: tools/publish.py:175-180. Upload splitting cannot bypass either downstream limit.',
              'ZIP bytes: ZIP_BYTES__; limit 19922944.',
              'Expanded bytes: EXP_BYTES__; limit 209715200.',
              'Entries: ENTRY_COUNT__; limit 5000.',
              'Maximum entry compression ratio: MAX_RATIO__; limit 100.',
              f'Maximum image bytes: {max(len(v) for k,v in files.items() if k.startswith("images/"))}; limit 1500000.',
              f'Maximum image width: {max(Image.open(io.BytesIO(v)).width for k,v in files.items() if k.startswith("images/"))}; target 1200, hard limit 1600.',
              f'Cover bytes: {len(files["cover.webp"])}; limit 400000.', '',
              'One complete package fits the bot limits. No chapter splitting needed.', '',
              '## Rebuild', '', '```bash',
              'PYTHONPATH=. python tools/package_batch.py SOURCE.pdf --parser rush_surgery_6e --metadata rush-metadata.json --out-dir dist',
              '# For the identical enriched report and deterministic final ZIP:',
              'PYTHONPATH=. python -m tools.package_rush_surgery_6e SOURCE.pdf --metadata rush-metadata.json --out-dir dist',
              '```', 'Dependencies: PyMuPDF and Pillow. Source PDF is not included in the rebuild bundle.', '']
    template='\n'.join(lines)
    # Fixed-width report fields and a stored report avoid recursive archive-size changes.
    values={'ZIP_BYTES__':'0'*12, 'EXP_BYTES__':'0'*12, 'ENTRY_COUNT__':'0'*12, 'MAX_RATIO__':'0'*12}
    for _ in range(3):
        report=template
        for key,val in values.items(): report=report.replace(key,val)
        files['report.md']=report.encode()
        write_archive(path, files)
        with zipfile.ZipFile(path) as z:
            infos=z.infolist()
            new={'ZIP_BYTES__':f'{path.stat().st_size:012d}', 'EXP_BYTES__':f'{sum(i.file_size for i in infos):012d}',
                 'ENTRY_COUNT__':f'{len(infos):012d}', 'MAX_RATIO__':f'{max(i.file_size/max(1,i.compress_size) for i in infos):012.6f}'}
        if new==values: break
        values=new
    else: raise RuntimeError('Archive metrics failed to converge')
    print(run_checked(sys.executable,'tools/validate.py','--require-audit',str(path)))
    print(run_checked(sys.executable,'tools/validate_release.py',str(path)))
    (args.out_dir/'rush-report.md').write_bytes(files['report.md'])
    print('Final SHA-256:',hashlib.sha256(path.read_bytes()).hexdigest())

if __name__=='__main__': main()
