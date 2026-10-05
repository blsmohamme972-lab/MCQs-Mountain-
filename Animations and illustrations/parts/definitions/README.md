# Part definitions and runtime infrastructure

The public `parts/medical-parts.js` file is the offline-compatible bundle and stable entry point. The catalog and this definitions area describe the separation boundary: geometry registrations are components, while validation, transforms, metadata discovery, batching and context injection belong to the engine. Future additions should be authored as definition modules and included in the bundle build; do not put scene controls or application code in a part.

Every definition must declare its version, sources, limitations, local bounds, attachments, dependencies, parameter schema and deterministic state behavior. The bundle keeps the existing classic-script API for hosts that cannot load modules.
