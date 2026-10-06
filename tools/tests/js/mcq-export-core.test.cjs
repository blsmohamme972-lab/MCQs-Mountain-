const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
global.crypto = webcrypto;
const Core = require('../../../app/modules/mcq-export-core.js');

(async () => {
  const unicode = {
    id: 'Q000000001',
    type: 'sba',
    stem: '  Café\n  Δ  ',
    options: [' First\tchoice ', 'Second'],
    answer: 'A',
    explanation: 'Line one\nLine two',
    source_page: 4,
    extra: { enabled: true, value: 2 }
  };
  const sameAsPublish = await Core.sha256Hex(Core.publisherFingerprintPayload(unicode));
  assert.equal(sameAsPublish, 'f974b7764447562bbc7a4083a9b20c1ced3114e1ca9f2957b8c83d2ef42be80b');
  const hash = await Core.sha256Hex(Core.canonicalJson(unicode));
  assert.equal(hash, '1abd05beb57b4b1d3b942838be09834ec86367e5176e2f5d86136e3ca0108c6f');
  assert.notEqual(hash, await Core.sha256Hex(Core.canonicalJson({ ...unicode, answer: 'B' })));
  assert.notEqual(hash, await Core.sha256Hex(Core.canonicalJson({ ...unicode, explanation: 'Changed' })));
  const duplicate = { ...unicode, id: 'Q000000002' };
  const book = { id: 'FIXTURE-BOOK', title: 'Fixture', version: 1, questions: 2, chapters: [{ id: 1, title: 'One', questions: 2, qids: [unicode.id, duplicate.id] }] };
  const packs = new Map([['1', { questions: [unicode, duplicate] }]]);
  const exported = await Core.buildExport({
    book, chapters: book.chapters, chapterPacks: packs,
    source: { catalog_url: 'https://content.example/catalog.json', catalog_sha256: 'a'.repeat(64), chapters: [] },
    scope: { chapter_id: null }, exportedAt: '2026-10-06T00:00:00.000Z'
  });
  assert.deepEqual(exported.questions, [unicode, duplicate]);
  assert.deepEqual(exported.questions.map((q) => q.id), ['Q000000001', 'Q000000002']);
  assert.equal(exported.exported_question_count, 2);
  assert.equal(exported.export_metadata.image_bytes_embedded, false);
  assert.equal(exported.ai_instructions.image_dependent_content_requires_actual_images, true);
  const split = Core.partitionExport(exported, 700);
  assert.equal(split.parts.length, 2);
  assert.deepEqual(split.parts.flatMap((part) => part.object.questions.map((q) => q.id)), [unicode.id, duplicate.id]);
  assert.deepEqual(split.parts.flatMap((part) => part.object.part.included_qids), [unicode.id, duplicate.id]);
  console.log('mcq export core contract: PASS');
})().catch((error) => { console.error(error); process.exit(1); });
