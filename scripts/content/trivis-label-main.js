/**
 * UsagiAutoX → Send By Trivis ❤️
 * Light: interval only, no heavy MutationObserver loop (was freezing page).
 */
(function () {
  if (window.__trivisLabelLite__ || window.__zokysLabelLite__) return;
  window.__trivisLabelLite__ = true;
  window.__zokysLabelLite__ = true;
  if (!/lovable\.dev/i.test(location.hostname || "")) return;

  var LABEL = "Send By Trivis ❤️";

  function scrub() {
    try {
      var walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      var n;
      while ((n = walk.nextNode())) {
        var v = n.nodeValue;
        if (v && (v.indexOf("UsagiAutoX") !== -1 || /^Read (txt|attach)/i.test(v.trim()))) {
          n.nodeValue = /UsagiAutoX/i.test(v) ? v.replace(/UsagiAutoX/g, LABEL) : LABEL;
        }
      }
    } catch (e) {}
  }

  setTimeout(scrub, 1500);
  setInterval(scrub, 800);
  // Light observer: childList only, debounced
  var t = null;
  try {
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () {
        t = null;
        scrub();
      }, 200);
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
