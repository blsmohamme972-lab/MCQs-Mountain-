/* Modules register before the base application; installers run immediately before boot. */
(function (root) {
  "use strict";
  const registry = root.KafuEnhancements = { installers: [], failures: [], installed: false,
    install() {
      if (this.installed) return;
      this.installed = true;
      for (const item of this.installers) {
        try { item.install(); }
        catch (_) { this.failures.push(item.name); console.warn("Kafu optional module unavailable:", item.name); }
      }
    }
  };
})(globalThis);
