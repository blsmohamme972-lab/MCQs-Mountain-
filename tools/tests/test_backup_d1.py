import gzip
import hashlib
import io
import json
import unittest
from contextlib import redirect_stdout
from datetime import datetime,timezone
from pathlib import Path
from unittest.mock import patch
from tools import backup_d1 as b
from tools.http_client import HttpStepError
ROOT=Path(__file__).resolve().parents[2]
SQL=(ROOT/"migrations/0001_publish_queue.sql").read_bytes()

class FakeStore:
    def __init__(self,private=True):self.private=private;self.items=[];self.deleted=[];self.fail=False
    def require_private(self):
        if not self.private:raise ValueError("private required")
    def ensure_release(self):pass
    def upload_verified(self,name,raw):
        if self.fail:raise ValueError("upload failed")
        self.items.append({"id":len(self.items)+1,"name":name,"size":len(raw),"raw":raw})
    def assets(self):return self.items
    def delete_asset(self,value):self.deleted.append(value)

class BackupTests(unittest.TestCase):
    def test_verified_bundle_restores_sql_and_records_checksums_without_data_output(self):
        store=FakeStore();logs=io.StringIO()
        with redirect_stdout(logs):
            result=b.backup(store,exporter=lambda p:p.write_bytes(SQL),now=datetime(2026,9,28,tzinfo=timezone.utc),run_id="123",commit="a"*40)
        self.assertEqual(gzip.decompress(store.items[0]["raw"]),SQL)
        self.assertEqual(result["sql_sha256"],hashlib.sha256(SQL).hexdigest())
        self.assertNotIn("CREATE TABLE",logs.getvalue())
        self.assertEqual(len(store.items),2)

    def test_public_repository_fails_before_export(self):
        with patch.object(b,"export_sql") as export:
            with self.assertRaises(ValueError):b.backup(FakeStore(False),exporter=export,run_id="1",commit="a"*40)
        export.assert_not_called()

    def test_export_validation_refuses_empty_missing_tables_and_external_attach(self):
        for raw in [b"",b"CREATE TABLE other(x);",b"ATTACH DATABASE '/tmp/unwanted.db' AS unsafe;"]:
            with self.assertRaises(ValueError):b.validate_sql(raw)

    def test_failed_upload_never_prunes_previous_assets(self):
        store=FakeStore();store.fail=True
        with self.assertRaises(ValueError):b.backup(store,exporter=lambda p:p.write_bytes(SQL),run_id="1",commit="a"*40)
        self.assertEqual(store.deleted,[])

    def test_retention_only_complete_backup_pairs_and_newest_is_protected(self):
        assets=[]
        for day in range(1,7):
            for ext in [".sql.gz",".json"]:assets.append({"id":len(assets)+1,"name":f"kafu-d1-202609{day:02d}T000000Z-1"+ext})
        assets += [{"id":99,"name":"content.sqlite"},{"id":100,"name":"kafu-d1-20260101T000000Z-1.sql.gz"}]
        removed=b.retention_candidates(assets,"kafu-d1-20260906T000000Z-1")
        self.assertEqual(set(removed),{1,2,3,4})
        with self.assertRaises(ValueError):b.retention_candidates(assets,"kafu-d1-20260928T000000Z-1")

    def test_403_is_not_treated_as_release_missing_and_dispatch_token_is_not_accepted(self):
        store=b.ReleaseStore("owner/repo","unit-token")
        with patch.object(b,"request_json",side_effect=HttpStepError("lookup","GET","https://api.github.com/x",403)) as request:
            with self.assertRaises(HttpStepError):store.ensure_release()
        self.assertEqual(request.call_count,1)
        with self.assertRaises(ValueError):b.ReleaseStore("owner/repo","")

    def test_404_creates_only_the_d1_backup_release(self):
        store=b.ReleaseStore("owner/repo","unit-token")
        with patch.object(b,"request_json",side_effect=[HttpStepError("lookup","GET","https://api.github.com/x",404),{"id":7,"tag_name":"d1-backups"}]) as request:
            store.ensure_release()
        self.assertEqual(request.call_args.kwargs["payload"]["tag_name"],"d1-backups")
        self.assertEqual(store.release_id,7)
