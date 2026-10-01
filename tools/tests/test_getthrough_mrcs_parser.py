import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import fitz

SPEC = importlib.util.spec_from_file_location("getthrough_parser", Path(__file__).resolve().parents[1] / "parsers" / "getthrough_mrcs_sba.py")
parser = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(parser)


class GetThroughParserTests(unittest.TestCase):
    def fixture(self, path, malformed=False):
        doc=fitz.open()
        for _ in range(423):
            doc.new_page()
        page=doc[0]
        page.insert_text((40,50), '1. The patient has a respiratory rate', fontsize=12)
        page.insert_text((40,66), '40. Which option describes the next step?', fontsize=12)
        for i,letter in enumerate('abce' if malformed else 'abcde'):
            page.insert_text((40,100+i*30), f'{letter}. Choice {letter}', fontsize=20.16)
        doc[1].insert_text((40,50), '1. b. The source identifies the correct choice.', fontname='hebo', fontsize=12)
        doc[1].insert_text((40,68), 'This sentence gives the source explanation.', fontsize=12)
        doc.save(path)
        doc.close()

    def test_wrapped_rate_is_not_a_question_and_large_options_are_not_headings(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'fixture.pdf'
            self.fixture(path)
            with patch.object(parser,'SECTIONS',[('Fixture',1,1,2,2,1)]):
                first=parser.parse_pdf(path)
                second=parser.parse_pdf(path)
        self.assertEqual(first,second)
        self.assertEqual(len(first['questions']),1)
        self.assertEqual(first['skipped'],[])
        q=first['questions'][0]
        self.assertIn('respiratory rate 40.',q['stem'])
        self.assertEqual(q['options'],[f'Choice {letter}' for letter in 'abcde'])
        self.assertEqual((q['answer'],q['source_page'],q['answer_page']),('B',1,2))
        self.assertTrue(all(item['passed'] for item in first['proof']))

    def test_ambiguous_options_are_preserved_as_skipped(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'fixture.pdf'
            self.fixture(path,malformed=True)
            with patch.object(parser,'SECTIONS',[('Fixture',1,1,2,2,1)]):
                result=parser.parse_pdf(path)
        self.assertEqual(result['questions'],[])
        self.assertEqual(result['skipped'][0]['local_id'],1)
        self.assertEqual(result['skipped'][0]['reason'],'ambiguous option labels')

    def test_printed_superscript_is_not_flattened_into_a_different_number(self):
        doc=fitz.open();page=doc.new_page()
        page.insert_text((40,60),'10',fontsize=12)
        page.insert_text((54,55),'9',fontsize=8)
        rows=parser.records(doc,1,1)
        self.assertIn('10⁹',[row['text'] for row in rows])
        doc.close()

    def test_wrong_page_layout_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'wrong.pdf'
            doc=fitz.open();doc.new_page();doc.save(path);doc.close()
            with self.assertRaisesRegex(ValueError,'423-page'):
                parser.parse_pdf(path)


if __name__=='__main__':
    unittest.main()
