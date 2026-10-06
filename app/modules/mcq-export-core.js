/* Pure helpers for the owner-only MCQ text export contract. */
(function (root, factory) {
  const api = factory(root);
  root.KafuMcqExportCore = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis, function (root) {
  "use strict";

  const MAX_PART_BYTES = 900_000;
  const HEX64 = /^[a-f0-9]{64}$/i;

  function normalize(value) {
    return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
  }

  /* This key order matches tools/publish.py fingerprint() with sort_keys=True. */
  function publisherFingerprintPayload(question) {
    return JSON.stringify({
      options: (question?.options || []).map(normalize),
      stem: normalize(question?.stem),
      type: question?.type ?? null,
    });
  }

  function canonicalJson(value) {
    if (value === null) return "null";
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new TypeError("non_finite_number");
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
    if (typeof value === "object") {
      return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
    }
    throw new TypeError("unsupported_json_value");
  }

  function utf8Bytes(text) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).byteLength;
    return unescape(encodeURIComponent(text)).length;
  }

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await root.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function integrityFor(question) {
    const authoritative = question && (question.publisher_fingerprint || question.fingerprint);
    const publisher_fingerprint = HEX64.test(String(authoritative || ""))
      ? String(authoritative).toLowerCase()
      : await sha256Hex(publisherFingerprintPayload(question));
    return {
      qid: question?.id ?? null,
      publisher_fingerprint,
      publisher_fingerprint_source: HEX64.test(String(authoritative || "")) ? "publisher" : "recomputed_from_publish_py_fingerprint_v1",
      content_hash: await sha256Hex(canonicalJson(question)),
      content_hash_algorithm: "SHA-256",
      content_hash_canonicalization: "kafu-question-canonical-json-v1",
    };
  }

  function imagePackMetadata(chapters, chapterPacks) {
    return chapters.map((chapter) => {
      const pack = chapterPacks.get(String(chapter.id));
      const names = new Set();
      for (const question of pack?.questions || []) {
        for (const field of ["images", "explanation_images"]) {
          for (const name of question?.[field] || []) if (typeof name === "string") names.add(name);
        }
      }
      return {
        chapter_id: chapter.id,
        url: chapter.image_url || null,
        entry_filenames: [...names].sort(),
        checksums_available: false,
        entry_checksums: {},
        bytes_embedded: false,
      };
    });
  }

  async function buildExport({ book, chapters, chapterPacks, source, scope, exportedAt }) {
    const questions = [];
    for (const chapter of chapters) questions.push(...(chapterPacks.get(String(chapter.id))?.questions || []));
    const question_integrity = [];
    for (const question of questions) question_integrity.push(await integrityFor(question));
    const expected = chapters.reduce((sum, chapter) => sum + Number(chapter.questions || 0), 0);
    return {
      export_type: "kafu_mcq_text_export",
      schema_version: 1,
      exported_at: exportedAt,
      source: {
        kind: "published",
        source_worker: "content-worker",
        catalog_url: source.catalog_url,
        catalog_sha256: source.catalog_sha256,
        index_url: book.index_url || null,
        snapshot_pinned: true,
        chapters: source.chapters,
      },
      scope: {
        type: scope.chapter_id == null ? "book" : "chapter",
        book_id: book.id,
        book_title: book.title,
        book_version: book.version,
        chapter_id: scope.chapter_id == null ? null : scope.chapter_id,
        chapter_title: scope.chapter_id == null ? "Whole book" : (chapters[0]?.title || null),
      },
      book,
      chapters,
      expected_question_count: expected,
      exported_question_count: questions.length,
      part: null,
      questions,
      export_metadata: {
        question_integrity,
        image_bytes_embedded: false,
        image_hash_scope: "question_json_only",
        image_packs: imagePackMetadata(chapters, chapterPacks),
        unavailable_metadata: {
          image_entry_checksums: "not published in the chapter manifest",
        },
        content_hash: {
          algorithm: "SHA-256",
          canonicalization: "kafu-question-canonical-json-v1",
          covers: "complete original published question object",
          excludes: "export_metadata",
          verifies_image_bytes: false,
        },
        partition_policy: {
          max_part_bytes: MAX_PART_BYTES,
          split_boundary: "question_record",
          oversized_single_question: "kept as one record in its own part",
        },
      },
      ai_instructions: {
        retain_fields: ["book_id", "book_version", "chapter_id", "qid", "publisher_fingerprint", "content_hash"],
        image_dependent_content_requires_actual_images: true,
        do_not_guess_image_content: true,
        image_bytes_embedded: false,
      },
    };
  }

  function jsonText(value) {
    return JSON.stringify(value, null, 2) + "\n";
  }

  function partObject(base, questions, integrity, index, count, total) {
    return {
      ...base,
      part: {
        index,
        count,
        total_question_count: total,
        question_count: questions.length,
        included_qids: questions.map((question) => question.id),
      },
      questions,
      export_metadata: { ...base.export_metadata, question_integrity: integrity },
    };
  }

  function partitionExport(base, limit = MAX_PART_BYTES) {
    const all = base.questions || [];
    const allIntegrity = base.export_metadata?.question_integrity || [];
    const completeText = jsonText(base);
    if (utf8Bytes(completeText) <= limit) return { completeText, parts: [] };

    const chunks = [];
    let current = [];
    const candidateBytes = (questions) => utf8Bytes(jsonText(partObject(base, questions, [], 0, 1, all.length)));
    for (const question of all) {
      const next = current.concat([question]);
      if (current.length && candidateBytes(next) > limit) {
        chunks.push(current);
        current = [question];
      } else current = next;
    }
    if (current.length) chunks.push(current);
    const parts = chunks.map((questions, index) => {
      const qids = new Set(questions.map((question) => question.id));
      const integrity = allIntegrity.filter((row) => qids.has(row.qid));
      const object = partObject(base, questions, integrity, index + 1, chunks.length, all.length);
      return { object, text: jsonText(object) };
    });
    return { completeText, parts };
  }

  function filename(value) {
    return String(value || "mcqs").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "mcqs";
  }

  return { MAX_PART_BYTES, normalize, publisherFingerprintPayload, canonicalJson, sha256Hex, integrityFor, buildExport, partitionExport, jsonText, filename, HEX64 };
});
