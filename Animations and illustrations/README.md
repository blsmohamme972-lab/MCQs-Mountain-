# Medical Animation & Illustration Template Library

A coding-only, dependency-free starter library for future AI agents that need to generate medical illustrations and short educational animations.

## Design rules for AI agents
1. Start from the closest template instead of building from zero.
2. Edit the `CONFIG` object first. Keep rendering code generic.
3. Prefer SVG for anatomy, arrows, labels, pathways, graphs, and procedural diagrams.
4. Use semantic visual layers: background -> anatomy/object -> process -> labels -> conclusion.
5. Keep the main teaching point visible within 6 seconds.
6. Default to vertical/mobile-friendly composition, but preserve responsive scaling.
7. Use color consistently: blue = structure/information, red = danger/arterial/high, green = success/normal, amber = warning, purple = drug/receptor.
8. Do not encode correctness using color alone; always pair color with text/symbols.
9. Keep labels short and readable. Avoid decorative motion that does not teach.
10. Respect `prefers-reduced-motion`.

## Included templates
- 01 Anatomy Callout — labeled organ/structure with focus ring and leader lines
- 02 Process Flow — stepwise pathophysiology or mechanism
- 03 Circulation Flow — vessel/chamber flow with moving particles
- 04 ECG & Vitals Monitor — waveform + numeric monitor
- 05 Pharmacology Receptor — ligand/receptor binding and downstream effect
- 06 Cell Pathology — normal-to-abnormal cellular transformation
- 07 Procedure Steps — sequential clinical/surgical procedure
- 08 Diagnostic Comparison — side-by-side differential/normal-vs-abnormal
- 09 Lab Trend — animated values, threshold zones, and interpretation
- 10 Neural Signal — neuron conduction and synaptic transmission

Each HTML file is self-contained and can be opened directly in a browser.

## Recommended AI workflow
Choose template -> replace CONFIG -> replace SVG geometry only if required -> preview -> verify scientific meaning -> export/screen-record if needed.

Future agents should add new templates as generic primitives, not as one-off disease pages.
