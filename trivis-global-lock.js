/**
 * Global Extension Lock — Anti-Lock Guardian & Banner Destroyer
 * Permanently removes all lock overlays, banners, badges, and blocks.
 * Guarantees zero chat-send or UI click interference for seamless method execution.
 */
(function () {
  "use strict";

  // Prevent multiple injections
  if (window.__trivisGlobalLockDisabled__) return;
  window.__trivisGlobalLockDisabled__ = true;
  window.__trivisGlobalLock1__ = true;
  window.__zokysGlobalLock1__ = true;

  if (!/lovable\.(dev|app)/i.test(location.hostname || "")) return;

  var locked = false;

  // 1. Force kill all lock elements & styles
  function purgeLockElements() {
    try {
      var lockNotice = document.getElementById("trivis-lock-notice") || document.getElementById("zokys-lock-notice");
      if (lockNotice) lockNotice.remove();

      var lockBanner = document.getElementById("trivis-lock-banner") || document.getElementById("zokys-lock-banner");
      if (lockBanner) lockBanner.remove();

      var lockCss = document.getElementById("trivis-lock-css") || document.getElementById("zokys-lock-css");
      if (lockCss) lockCss.remove();

      // Clear lock badges from toolbar & action buttons
      var badges = document.querySelectorAll(".trivis-lock-badge, .zokys-lock-badge");
      for (var i = 0; i < badges.length; i++) {
        badges[i].remove();
      }

      // Remove lock attributes from root
      var root = document.getElementById("trivis-vx-root");
      if (root) {
        root.removeAttribute("data-trivis-locked");
        root.removeAttribute("data-zokys-locked");
        root.style.removeProperty("opacity");
      }

      // Remove lock badges attributes on buttons
      var lockedBtns = document.querySelectorAll("[data-trivis-lock-badge], [data-zokys-lock-badge]");
      for (var j = 0; j < lockedBtns.length; j++) {
        lockedBtns[j].removeAttribute("data-trivis-lock-badge");
        lockedBtns[j].removeAttribute("data-zokys-lock-badge");
      }

      // Clear session seen tokens
      try {
        sessionStorage.removeItem("trivis_lock_seen");
        sessionStorage.removeItem("zokys_lock_seen");
      } catch (_) {}
    } catch (_) {}
  }

  // 2. Inject override stylesheet to permanently suppress any lock notice or banner
  function ensureSuppressionCss() {
    if (document.getElementById("trivis-anti-lock-css")) return;
    var st = document.createElement("style");
    st.id = "trivis-anti-lock-css";
    st.textContent =
      "#trivis-lock-notice, #zokys-lock-notice, #trivis-lock-banner, #zokys-lock-banner, .trivis-lock-badge, .zokys-lock-badge {" +
      "display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important;z-index:-9999!important;width:0!important;height:0!important;overflow:hidden!important;" +
      "}" +
      "#trivis-vx-root { pointer-events:none!important; width:0!important; height:0!important; overflow:visible!important; position:fixed!important; top:0!important; left:0!important; } " +
      "#trivis-vx-panel, #trivis-vx-panel * { pointer-events:auto!important; }";
    (document.head || document.documentElement).appendChild(st);
  }

  // 3. Clear local storage lock flags
  function sanitizeStorage() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        // First check if Trivis is licensed — only patch native guard keys if licensed
        chrome.storage.local.get(["trivis_lic_ok", "trivis_license_key"], function (s) {
          var isLicensed = !!(s && (s.trivis_lic_ok === true || s.trivis_lic_ok === "1") && s.trivis_license_key);
          var updates = {
            trivis_extension_locked: false,
            zokys_extension_locked: false,
            trivis_is_locked: false,
            zokys_is_locked: false,
            trivis_lock_message: "",
            zokys_lock_message: "",
            trivis_update_required: false
          };
          if (isLicensed) {
            // Keep Lovable native guard permanently OFF while Trivis is active
            updates.eu_license_valid = true;
            updates.ql_license_valid = true;
            updates.ql_extension_state = {
              permissions: { chat_allowed: true, projects_allowed: true },
              trivis_managed: true
            };
          }
          try { chrome.storage.local.set(updates); } catch (_) {}
        });
      }
    } catch (_) {}
  }


  // 4. MutationObserver for instant removal if any script tries to inject lock notice
  try {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType === 1) {
            if (
              node.id === "trivis-lock-notice" ||
              node.id === "zokys-lock-notice" ||
              node.id === "trivis-lock-banner" ||
              node.id === "zokys-lock-banner" ||
              (node.className && typeof node.className === "string" && (node.className.indexOf("zk-n-card") !== -1 || node.className.indexOf("trivis-lock-badge") !== -1))
            ) {
              node.remove();
            }
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  } catch (_) {}

  // 5. Runtime message listener — force locked to false on TRIVIS_LOCK_STATE
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(function (msg) {
        if (!msg) return;
        if (msg.type === "TRIVIS_LOCK_STATE" || msg.type === "ZOKYS_LOCK_STATE") {
          locked = false;
          purgeLockElements();
          sanitizeStorage();
        }
      });
    }
  } catch (_) {}

  // 6. Execute immediately and at brief intervals
  ensureSuppressionCss();
  purgeLockElements();
  sanitizeStorage();

  setInterval(function () {
    purgeLockElements();
  }, 1000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", purgeLockElements, { once: true });
  }
})();
