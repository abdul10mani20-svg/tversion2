/**
 * Remove V5 freeze "License required" chat lock if license already active in Trivis storage.
 * High Performance Edition: No aggressive mutation observer, no full-DOM queries, zero typing lag.
 *
 * v3.1 — FIXED: Also clears ql_extension_state native guard so Lovable chat/projects load correctly.
 */
(function () {
  "use strict";
  if (window.__trivisLicKiller__ || window.__zokysLicKiller__) return;
  window.__trivisLicKiller__ = true;
  window.__zokysLicKiller__ = true;

  var cachedOk = false;

  // ── Core: fix native guard state so Lovable's own content.js doesn't block chat ──
  function fixNativeGuardState() {
    try {
      chrome.storage.local.get(
        ["ql_extension_state", "eu_license_valid", "ql_license_valid"],
        function (s) {
          var updates = {};
          var needsUpdate = false;

          // Ensure eu_license_valid / ql_license_valid are true so guard stays off
          if (!s.eu_license_valid) {
            updates.eu_license_valid = true;
            needsUpdate = true;
          }
          if (!s.ql_license_valid) {
            updates.ql_license_valid = true;
            needsUpdate = true;
          }

          // Patch ql_extension_state.permissions.chat_allowed to true
          var extState = s.ql_extension_state || {};
          var perms = extState.permissions || {};
          if (perms.chat_allowed === false || perms.chat_allowed === undefined) {
            perms.chat_allowed = true;
            extState.permissions = perms;
            updates.ql_extension_state = extState;
            needsUpdate = true;
          }

          if (needsUpdate) {
            try {
              chrome.storage.local.set(updates);
            } catch (_) {}
          }
        }
      );
    } catch (_) {}
  }

  // ── Remove any guard overlays injected by content.js over Lovable forms ──
  function removeNativeGuardOverlays() {
    try {
      // Remove the ql-license-guard overlay divs that content.js injects on form elements
      var guardDivs = document.querySelectorAll(
        "[data-trivis-native-guard], [data-ql-license-guard], " +
        ".ql-license-guard-overlay, #ql-license-guard-overlay, " +
        "[class*='ql-license-guard'], [id*='ql-license-guard']"
      );
      for (var i = 0; i < guardDivs.length; i++) {
        try { guardDivs[i].remove(); } catch (_) {}
      }

      // Re-enable any form elements that were disabled by the guard
      if (!cachedOk) return;
      var disabledForms = document.querySelectorAll("[data-ql-guard-disabled]");
      for (var j = 0; j < disabledForms.length; j++) {
        var form = disabledForms[j];
        try {
          // Remove guard overlay children
          var overlays = form.querySelectorAll("[data-trivis-native-guard], .ql-license-guard-overlay");
          for (var k = 0; k < overlays.length; k++) {
            try { overlays[k].remove(); } catch (_) {}
          }
          // Re-enable inputs
          var inputs = form.querySelectorAll("input, button, textarea, [contenteditable]");
          for (var m = 0; m < inputs.length; m++) {
            try {
              inputs[m].disabled = false;
              inputs[m].removeAttribute("tabindex");
              if (inputs[m].contentEditable === "false") inputs[m].contentEditable = "true";
            } catch (_) {}
          }
          form.style.removeProperty("pointer-events");
          form.removeAttribute("data-ql-guard-disabled");
        } catch (_) {}
      }
    } catch (_) {}
  }

  function checkLicenseState() {
    try {
      chrome.storage.local.get(
        ["trivis_lic_ok", "trivis_license_key", "trivis_lic_expires"],
        function (s) {
          var ok = !!(s && (s.trivis_lic_ok === true || s.trivis_lic_ok === "1") && s.trivis_license_key);
          if (ok && s.trivis_lic_expires) {
            var t = Date.parse(s.trivis_lic_expires);
            if (t && Date.now() > t) ok = false;
          }
          cachedOk = ok;
          if (cachedOk) {
            killOverlay();
            fixNativeGuardState();
            removeNativeGuardOverlays();
          }
        }
      );
    } catch (_) {}
  }

  function killOverlay() {
    if (!cachedOk) return;
    try {
      // Targeted modal lookup instead of scanning thousands of divs across whole page
      var targets = document.querySelectorAll("[role='dialog'], dialog, [class*='modal' i], [class*='overlay' i], [class*='lock' i], [id*='lock' i]");
      var killedAny = false;
      for (var i = 0; i < targets.length; i++) {
        var el = targets[i];
        if (el.closest && el.closest("#trivis-vx-root")) continue;
        if (el.getAttribute("data-trivis-killed-lic") === "1" || el.getAttribute("data-zokys-killed-lic") === "1") continue;
        var t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!t || t.length > 300) continue;
        if (
          /License required/i.test(t) &&
          (/Activate your license/i.test(t) || /prompt box/i.test(t) || /Lovable extension/i.test(t))
        ) {
          try {
            el.style.setProperty("display", "none", "important");
            el.style.setProperty("pointer-events", "none", "important");
            el.setAttribute("data-trivis-killed-lic", "1");
            el.setAttribute("data-zokys-killed-lic", "1");
            var p = el.parentElement;
            if (p && (p.textContent || "").length < 400 && /License required/i.test(p.textContent || "")) {
              p.style.setProperty("display", "none", "important");
            }
            killedAny = true;
          } catch (_) {}
        }
      }

      // Unconditionally ensure composer is unlocked when license is active
      var tas = document.querySelectorAll("textarea, [contenteditable='true'], input[type='text'], input:not([type])");
      for (var j = 0; j < tas.length; j++) {
        var n = tas[j];
        if (n.closest && n.closest("#trivis-vx-root")) continue;
        try {
          if (n.style.pointerEvents === "none") n.style.removeProperty("pointer-events");
          if (n.disabled) n.disabled = false;
          if (n.readOnly) n.readOnly = false;
        } catch (_) {}
      }
    } catch (_) {}
  }

  checkLicenseState();
  setInterval(function () {
    killOverlay();
    if (cachedOk) {
      fixNativeGuardState();
      removeNativeGuardOverlays();
    }
  }, 4500);

  try {
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== "local") return;
      if (ch.trivis_lic_ok || ch.trivis_license_key || ch.trivis_lic_expires) {
        checkLicenseState();
      }
    });
  } catch (_) {}

  // Tell page freeze license is OK (best-effort)
  try {
    chrome.storage.local.get(["trivis_lic_ok", "trivis_license_key"], function (s) {
      if (s && (s.trivis_lic_ok === true || s.trivis_lic_ok === "1")) {
        try {
          window.postMessage({ type: "TRIVIS_LICENSE_OK", ok: true, key: s.trivis_license_key || "" }, "*");
        } catch (_) {}
        // Also broadcast a native guard deactivation signal
        try {
          window.postMessage({ type: "QL_NATIVE_GUARD_STATE", active: false, licensed: true }, "*");
        } catch (_) {}
      }
    });
  } catch (_) {}
})();
