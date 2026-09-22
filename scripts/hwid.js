/**
 * Trivis Extension — Persistent Hardware Device Fingerprinting
 * Generates and persists a stable unique device ID across sessions.
 * Must be imported AFTER config.js.
 */

"use strict";

/**
 * Get the persisted device ID from storage, or generate+save a new one.
 * @returns {Promise<string>} Persistent device UUID
 */
async function getHwid() {
  const KEY_HWID   = TRIVIS_CONFIG.STORAGE.HWID;
  const KEY_DEVID  = TRIVIS_CONFIG.STORAGE.DEVICE_ID;

  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([KEY_HWID, KEY_DEVID], (r) => {
        // Prefer hwid, fall back to legacy device_id
        const existing = (r && (r[KEY_HWID] || r[KEY_DEVID])) || null;
        if (existing) return resolve(existing);
        const id = _generateDeviceId();
        chrome.storage.local.set({ [KEY_HWID]: id, [KEY_DEVID]: id }, () => resolve(id));
      });
    } catch (_) {
      resolve(_generateDeviceId());
    }
  });
}

/**
 * Generate a stable fingerprint-based device ID.
 * Uses crypto random bytes for uniqueness, prefixed with "tv_".
 * @returns {string}
 */
function _generateDeviceId() {
  let id = "tv_";
  try {
    // 18 random bytes → 36 hex chars
    const arr = new Uint8Array(18);
    (typeof crypto !== "undefined" && crypto.getRandomValues)
      ? crypto.getRandomValues(arr)
      : _fallbackRandom(arr);
    id += Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 24);
  } catch (_) {
    id += Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return id;
}

function _fallbackRandom(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
}
