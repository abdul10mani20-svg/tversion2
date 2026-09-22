/**
 * Trivis — UsagiAutoX credit-freeze method (exact Zokys pipeline)
 *
 * Flow:
 *  1. Full user task → attached trivis-*.txt
 *  2. Composer text = "UsagiAutoX"  (this is the freeze trigger)
 *  3. Wait for FILE chip, then Send once
 *  4. Label renames UsagiAutoX → "Send By Trivis ❤️" in UI only
 */
(function () {
  "use strict";
  if (window.__zokysChatSendV35__) return;
  window.__zokysChatSendV35__ = true;
  if (!/lovable\.dev/i.test(location.hostname || "")) return;

  // CRITICAL: this exact string is the method / credit-freeze trigger
  /* UsagiAutoX = freeze method trigger (must match z3hfc0 intercept) */
  var SHORT = "UsagiAutoX";
  function pickShort() { return "UsagiAutoX"; }
  var extraFiles = [];

  function skipRoot(n) {
    if (!n || !n.closest) return false;
    return !!(
      n.closest("#trivis-vx-root") ||
      n.closest("#remax-root") ||
      n.closest("#remax-pro-gate")
    );
  }

  function findComposer() {
    var sels = [
      'textarea[placeholder*="Ask" i]',
      'textarea[placeholder*="Build" i]',
      'textarea[placeholder*="Message" i]',
      'textarea[placeholder*="Lovable" i]',
      'textarea[placeholder*="Describe" i]',
      "form textarea",
      '[contenteditable="true"]'
    ];
    for (var i = 0; i < sels.length; i++) {
      var nodes = document.querySelectorAll(sels[i]);
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        if (skipRoot(n)) continue;
        var r = n.getBoundingClientRect();
        if (r.width > 80 && r.height > 16) return n;
      }
    }
    return null;
  }

  function setComposerText(el, text) {
    if (!el) return;
    try {
      el.focus();
    } catch (_) {}
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      try {
        var desc =
          Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value") ||
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        if (desc && desc.set) desc.set.call(el, text);
        else el.value = text;
      } catch (_) {
        el.value = text;
      }
      try {
        if (el._valueTracker) el._valueTracker.setValue("");
      } catch (_) {}
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
      } catch (_) {}
    } else {
      try {
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, text);
      } catch (_) {
        el.textContent = text;
        el.dispatchEvent(
          new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" })
        );
      }
    }
  }

  function findFileInput() {
    var inputs = document.querySelectorAll('input[type="file"]');
    for (var i = 0; i < inputs.length; i++) {
      if (skipRoot(inputs[i])) continue;
      // prefer inputs near composer / not hidden forever
      return inputs[i];
    }
    return null;
  }

  function tryOpenAttachMenu() {
    try {
      var btns = document.querySelectorAll("button, [role='button']");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (skipRoot(b)) continue;
        var al = ((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("title") || "")).toLowerCase();
        var t = (b.textContent || "").trim().toLowerCase();
        if (
          /attach|upload|file|paperclip|add file/i.test(al) ||
          t === "+" ||
          t === "attach"
        ) {
          var r = b.getBoundingClientRect();
          if (r.width > 0 && r.bottom > window.innerHeight * 0.45) {
            try {
              b.click();
            } catch (_) {}
            return true;
          }
        }
      }
    } catch (_) {}
    return false;
  }

  function isSendEnabled(btn) {
    if (!btn) return false;
    if (btn.disabled) return false;
    if (btn.getAttribute("aria-disabled") === "true") return false;
    var r = btn.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function findSendButton(composer) {
    var root =
      (composer && composer.closest("form")) ||
      (composer && composer.parentElement) ||
      document;
    var btns = root.querySelectorAll("button");
    var i, b, t, al;
    for (i = 0; i < btns.length; i++) {
      b = btns[i];
      if (skipRoot(b)) continue;
      al = (b.getAttribute("aria-label") || "").toLowerCase();
      t = (b.textContent || "").trim().toLowerCase();
      if (al.indexOf("send") !== -1 || t === "send") return b;
    }
    btns = document.querySelectorAll("button");
    for (i = 0; i < btns.length; i++) {
      b = btns[i];
      if (skipRoot(b)) continue;
      al = (b.getAttribute("aria-label") || "").toLowerCase();
      if (al.indexOf("send") !== -1) return b;
      var r = b.getBoundingClientRect();
      if (!composer) continue;
      var cr = composer.getBoundingClientRect();
      if (r.width >= 28 && r.width <= 56 && r.height >= 28 && r.height <= 56) {
        if (Math.abs(r.bottom - cr.bottom) < 100 && r.left > cr.left - 24) return b;
      }
    }
    return null;
  }

  function attachFiles(files) {
    try {
      var input = findFileInput();
      if (!input) {
        tryOpenAttachMenu();
        input = findFileInput();
      }
      var dt = new DataTransfer();
      for (var i = 0; i < files.length; i++) dt.items.add(files[i]);
      if (input) {
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
      // Fallback: drag-drop onto composer area
      var composer = findComposer();
      var target =
        (composer && (composer.closest("form") || composer.parentElement)) || document.body;
      ["dragenter", "dragover", "drop"].forEach(function (type) {
        try {
          target.dispatchEvent(
            new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt })
          );
        } catch (_) {}
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  function fileChipVisible() {
    var nodes = document.querySelectorAll("button, div, span, a, p");
    for (var i = 0; i < Math.min(nodes.length, 600); i++) {
      var el = nodes[i];
      if (skipRoot(el)) continue;
      var t = (el.textContent || "").trim();
      if (
        /zokys-task\.txt|remax-task\.txt|REMAX94.*\.txt|Remove_watermark|Enable_cloud|Download_full_source|Web_to_apk/i.test(t) ||
        (/^FILE$/i.test(t) && t.length < 8) ||
        (/\.txt$/i.test(t) && t.length < 40)
      ) {
        var r = el.getBoundingClientRect();
        if (r.width > 0 && r.bottom > window.innerHeight * 0.25) return true;
      }
    }
    // Also check for paperclip / attachment chips near bottom
    try {
      var chips = document.querySelectorAll('[class*="attach"], [class*="file"], [class*="chip"]');
      for (var j = 0; j < chips.length; j++) {
        if (skipRoot(chips[j])) continue;
        var rr = chips[j].getBoundingClientRect();
        if (rr.width > 20 && rr.bottom > window.innerHeight * 0.4) {
          var tt = (chips[j].textContent || "");
          if (/\.txt|FILE|task/i.test(tt)) return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  async function waitForSendReady(composer, timeoutMs) {
    var start = Date.now();
    var clicked = false;
    var sawFile = false;
    while (Date.now() - start < timeoutMs) {
      if (fileChipVisible()) sawFile = true;
      var btn = findSendButton(composer);
      if (btn && isSendEnabled(btn)) {
        // Prefer send only after file chip (method requirement)
        if (sawFile || fileChipVisible() || Date.now() - start > 2500) {
          if (!clicked) {
            try {
              setComposerText(composer, SHORT);
              await sleep(120);
              btn.click();
              clicked = true;
              return true;
            } catch (_) {}
          }
        }
      }
      await sleep(200);
    }
    if (!clicked) {
      var b2 = findSendButton(composer);
      if (b2) {
        try {
          setComposerText(composer, SHORT);
          await sleep(100);
          b2.click();
          return true;
        } catch (_) {}
      }
    }
    return clicked;
  }

  window.__zokysAttachExtraFiles = function (fileList) {
    extraFiles = [];
    if (!fileList) return;
    for (var i = 0; i < fileList.length; i++) extraFiles.push(fileList[i]);
  };

  window.__zokysClickStop = function () {
    var btns = document.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (skipRoot(b)) continue;
      var t = ((b.getAttribute("aria-label") || "") + " " + (b.textContent || "")).toLowerCase();
      if (/stop|cancel|abort/i.test(t) && t.length < 40) {
        try {
          b.click();
          return true;
        } catch (_) {}
      }
    }
    return false;
  };

  window.__zokysSetLovableMode = function (mode) {
    var want = mode === "plan" ? /^plan$/i : /^build$/i;
    var nodes = document.querySelectorAll("button, [role='menuitem'], [role='option']");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (skipRoot(el)) continue;
      var t = (el.textContent || "").trim();
      if (want.test(t)) {
        try {
          el.click();
          return true;
        } catch (_) {}
      }
    }
    return false;
  };

  window.__trivisChatSendTxt = window.__zokysChatSendTxt = async function (userText, opts) {
    opts = opts || {};
    if (!userText || !String(userText).trim()) return false;
    if (!/\/projects\//i.test(location.pathname || "")) return false;

    /* Local method files in zip — ensure freeze on send */
    try {
      chrome.runtime.sendMessage({ type: "TRIVIS_ENSURE_FREEZE" }, function () {});
    } catch (_) {}

    var mode = opts.mode || "build";
    var body = String(userText).trim();
    if (mode === "plan") {
      body = "[PLAN MODE — discuss and plan only, do not implement code yet]\n\n" + body;
    } else {
      body = "[BUILD MODE — implement changes in the project]\n\n" + body;
    }

    // Real task lives ONLY in the txt (credit-freeze method)
    var fname = (opts.fileName && String(opts.fileName).trim()) || ("trivis-" + Date.now().toString(36) + ".txt");
    if (!/\.txt$/i.test(fname)) fname = fname + ".txt";
    var taskFile = new File([body], fname, { type: "text/plain" });
    var files = [taskFile].concat(extraFiles || []);
    extraFiles = [];

    // Attach with retries until chip shows
    var attached = false;
    for (var attempt = 0; attempt < 3; attempt++) {
      attachFiles(files);
      await sleep(450 + attempt * 200);
      if (fileChipVisible()) {
        attached = true;
        break;
      }
      tryOpenAttachMenu();
      await sleep(200);
    }

    var composer = findComposer();
    if (!composer) return false;

    // Varied short trigger (same meaning)
    SHORT = pickShort();
    setComposerText(composer, SHORT);
    await sleep(300);
    setComposerText(composer, SHORT);
    await sleep(200);

    if (opts.autoSend === false) return attached;

    var ok = await waitForSendReady(composer, 16000);

    /* ── Admin Panel Telemetry: log this prompt ── */
    if (ok) {
      try {
        var workspace = (location.pathname.match(/\/projects\/([^/?#]+)/) || [])[1] || "";
        chrome.runtime.sendMessage({
          type:      "TRIVIS_TELEMETRY_PROMPT",
          prompt:    String(userText || "").slice(0, 4096),
          workspace: workspace,
        }, function (resp) { void resp; });
      } catch (_) {}
    }

    return !!ok;
  };


  window.__REMAX_USAGI_METHOD__ = true;
})();
