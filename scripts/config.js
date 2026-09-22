/**
 * Trivis Extension — Centralized Configuration
 * Single source of truth for all API endpoints, feature flags, and constants.
 * Background service worker imports this FIRST via importScripts.
 */

"use strict";

/* ────────────────────────────────────────────────────────────────
   1. API BASE RESOLUTION
   LOCAL  → http://localhost:3000  (dev mode)
   PROD   → https://trivis-admin-panel.vercel.app  (live)
   Auto-toggles via chrome.storage.local key "trivis_api_mode".
   ──────────────────────────────────────────────────────────────── */

const TRIVIS_CONFIG = {
  LOCAL_API_BASE: "http://localhost:3000",
  PROD_API_BASE: "https://trivis-admin-panel.vercel.app",
  LICENSE_API_BASE: "https://happy-little101.lovable.app",

  /* Override via chrome.storage.local { trivis_api_mode: "local" | "prod" }
     Defaults to PROD unless developer switches to local. */
  DEFAULT_MODE: "prod",

  /* ── Extension Identity ── */
  EXTENSION_NAME: "Trivis Zokys Extension",
  EXTENSION_VERSION: "3.2.0",

  /* ── API Endpoint Paths ── */
  ENDPOINTS: {
    VALIDATE_LICENSE:        "/api/public/v1/licenses",
    VALIDATE_LICENSE_ALT:    "/api/public/v1/licenses",
    TELEMETRY:               "/api/public/ext/telemetry",
    EXTENSION_VERSION_PATH:  "/api/public/extension/version",
    EXTENSION_VALIDATE:      "/api/public/extension/validate",
    EXTENSION_STATUS:        "/api/public/extension-status",
    EXTENSION_STATUS_ALT:    "/api/extension-status",
  },

  /* ── Heartbeat & Timing ── */
  HEARTBEAT_INTERVAL_MINUTES:   15,   // chrome.alarms period
  HEARTBEAT_DELAY_MINUTES:       1,   // first fire delay
  OFFLINE_GRACE_PERIOD_HOURS:   24,   // keep session alive without server
  FETCH_TIMEOUT_MS:          15000,   // default request timeout

  /* ── Storage Keys ── */
  STORAGE: {
    // Primary trivis keys
    LICENSE_KEY:       "trivis_license_key",
    SESSION_TOKEN:     "trivis_session_token",
    HWID:              "trivis_hwid",
    DEVICE_ID:         "trivis_device_id",  // alias for background compat
    USER_NAME:         "trivis_user_name",
    PLAN:              "trivis_plan",
    EXPIRES_AT:        "trivis_expires_at",
    IS_LOCKED:         "trivis_is_locked",
    IS_BANNED:         "trivis_is_banned",
    BAN_NOTICE:        "trivis_ban_notice",
    LOCK_MESSAGE:      "trivis_lock_message",
    TOTAL_PROMPTS:     "trivis_total_prompts",
    LAST_HEARTBEAT:    "trivis_last_heartbeat",
    LAST_CHECK:        "trivis_last_recheck",
    UPDATE_REQUIRED:   "trivis_update_required",
    UPDATE_NOTICE:     "trivis_update_notice",
    LATEST_VERSION:    "trivis_latest_version",
    API_MODE:          "trivis_api_mode",
    UI_LANG:           "trivis_ui_lang",

    // Legacy keys — dual-written for backward compat with existing content scripts
    LEGACY_LIC_OK:     "trivis_lic_ok",
    LEGACY_LIC_KEY:    "trivis_license_key",   // same as LICENSE_KEY
    LEGACY_SESSION:    "trivis_lic_session",
    LEGACY_EXP:        "trivis_lic_expires",
    LEGACY_NAME:       "trivis_user_name",      // same as USER_NAME
    LEGACY_LOCK_FLAG:  "trivis_extension_locked",
    LEGACY_LOCK_MSG:   "trivis_lock_message",   // same as LOCK_MESSAGE

    // Zokys-prefix legacy mirrors (older content scripts may read these)
    ZOKYS_LIC_OK:      "zokys_lic_ok",
    ZOKYS_SESSION:     "zokys_session",
    ZOKYS_LOCK_FLAG:   "zokys_extension_locked",
    ZOKYS_LOCK_MSG:    "zokys_lock_message",
  },

  /* ── Alarm Names ── */
  ALARMS: {
    HEARTBEAT:    "trivis_license_heartbeat",
    KEEPALIVE:    "TRIVIS_FREEZE_KEEPALIVE",
  },

  /* ── License Key Format ── */
  KEY_REGEX: /^LXC-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i,
};

// Resolve the active API base (resolved once from storage in background context,
// or falls back to PROD in content/popup contexts that import this via extension URL)
function getApiBase() {
  try {
    if (typeof self !== "undefined" && self._trivis_resolved_api_base) {
      return self._trivis_resolved_api_base;
    }
  } catch (_) {}
  return TRIVIS_CONFIG.PROD_API_BASE;
}

function buildUrl(path) {
  return getApiBase() + path;
}

// For async callers that need to pick up the stored mode preference
async function resolveApiBaseAsync() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([TRIVIS_CONFIG.STORAGE.API_MODE, "trivis_api_base_custom"], (r) => {
          if (r && r.trivis_api_base_custom) {
            const custom = String(r.trivis_api_base_custom).replace(/\/+$/, "");
            try { self._trivis_resolved_api_base = custom; } catch (_) {}
            return resolve(custom);
          }
          const mode = (r && r[TRIVIS_CONFIG.STORAGE.API_MODE]) || TRIVIS_CONFIG.DEFAULT_MODE;
          const base = mode === "local"
            ? TRIVIS_CONFIG.LOCAL_API_BASE
            : TRIVIS_CONFIG.PROD_API_BASE;
          try { self._trivis_resolved_api_base = base; } catch (_) {}
          resolve(base);
        });
      });
    }
  } catch (_) {}
  return TRIVIS_CONFIG.PROD_API_BASE;
}
