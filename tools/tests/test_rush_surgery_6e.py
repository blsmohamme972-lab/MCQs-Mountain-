"""Focused helpers and integration checks against the prepared source package."""
import json,sys,unittest,zipfile
from pathlib import Path
from tools.parsers.rush_surgery_6e import clean,join_text,excerpt,FULL_TABLES,TABLE_END,SPECIAL_FIGS
class TypographyTests(unittest.TestCase):
 def test_source_confirmed_word_join(self):
  self.assertEqual(join_text(['cytomegalovi-', 'rus'], {'cytomegalovirus'}),'cytomegalovirus')
  self.assertEqual(join_text(['split- and full-thickness'],set()),'split- and full-thickness')
 def test_signs_remain_distinct(self):
  self.assertNotEqual(clean('HBcAb+'),clean('HBcAb-'))
 def test_full_sentence_excerpt(self):
  self.assertEqual(excerpt('One. Two. Three. Four. Five.'),'One. Two. Three. Four.')
 def test_verified_crop_boundaries(self):
  self.assertNotIn(510,FULL_TABLES)
  self.assertEqual(TABLE_END[310],350)
  self.assertGreaterEqual(SPECIAL_FIGS['23B.1'][1][3],703)

def check_package(path):
 with zipfile.ZipFile(path) as z:
  qs=[json.loads(x) for x in z.read('questions.jsonl').splitlines()]
  audit=json.loads(z.read('audit.json'))
  assert len(qs)==1607
  assert [q['local_id'] for q in qs]==list(range(1,1608))
  assert not audit['mismatch_count']
  assert [qs[n-1]['answer'] for n in (546,547,548)]==['C','E','B']
  assert qs[846]['options'][-1]=='Attachment of the phrenoesophageal ligament 4 cm above the GEJ'
  assert len(qs[1181]['options'])==5 and all(v.startswith('| ') for v in qs[1181]['options'])
  assert len(qs[1561]['options'])==5 and all(v.startswith('| ') for v in qs[1561]['options'])
  assert not qs[441]['explanation']
  assert all(q['flag']=='' for q in qs)
  assert sum(len(q['images'])+len(q['explanation_images']) for q in qs)==84
 print('Package regression checks: PASS')
if __name__=='__main__':
 if len(sys.argv)>1:check_package(Path(sys.argv.pop()))
 unittest.main()
