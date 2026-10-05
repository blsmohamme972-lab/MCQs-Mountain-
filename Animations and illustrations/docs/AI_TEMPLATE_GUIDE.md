# AI template selection guide

This is the shortest handoff for an AI creating a new HTML medical visual from this library.

1. Search `catalog.json` by **mechanism** and keywords. Pick the closest mechanism, not merely the disease name.
2. Open the selected template's metadata and its example in `examples/`.
3. Copy the example JSON. Change only `title`, `subtitle`, `caption`, `duration`, `format`, `theme`, declared `params`, and declared `labels`.
4. Run `MedicalMotion.validate(scene)` before rendering. Unknown keys and out-of-range values must fail visibly.
5. Load only `core/medical-motion.js` and the selected numbered template, then call `MedicalMotion.standalone(scene)` for one portable HTML file.
6. Review the first, middle and last frames in portrait, and keep labels short.

## Selection map

| Need | Start with |
| --- | --- |
| A transport direction across a membrane | `membrane-transport`, `osmosis`, `alveolar-exchange` |
| A molecule-to-molecule information flow | `transcription`, `translation`, `dna-replication`, `second-messenger` |
| A cell taking in or clearing material | `phagocytosis`, `chemical-synapse`, `endocrine-negative-feedback` |
| A flow through a tube or vessel | `vessel-flow`, `peristalsis`, `venous-valves`, `capillary-filtration` |
| A tissue repair sequence | `wound-healing`, `fracture-repair`, `bone-remodeling`, `coagulation-fibrin` |
| A metabolism or energy mechanism | `enzyme-inhibition`, `oxidative-phosphorylation`, `acid-base-buffer` |
| Immune or lymph movement | `leukocyte-recruitment`, `lymphatic-drainage`, `antibody-neutralization` |

The drawings are original conceptual SVGs. Their source links support the direction of the mechanism; they do not make the art a clinical simulator. Keep clinical claims, dosing, diagnosis and patient-specific predictions out of generated scenes.
