/**
 * Native chat lock disabled — cleans any leftover lock overlays and banners.
 */
(function () {
  "use strict";
  if (window.__trivisNativeLockOff__ || window.__zokysNativeLockOff__) return;
  window.__trivisNativeLockOff__ = true;
  window.__zokysNativeLockOff__ = true;

  function clear() {
    try {
      var ids = [
        "trivis-native-lock",
        "zokys-native-lock",
        "trivis-lock-notice",
        "zokys-lock-notice",
        "trivis-lock-banner",
        "zokys-lock-banner",
        "trivis-lock-css",
        "zokys-lock-css"
      ];
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) el.remove();
      }
    } catch (_) {}
  }

  clear();
  setInterval(clear, 2000);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", clear, { once: true });
  }
})();
