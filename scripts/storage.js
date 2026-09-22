/**
 * Trivis Extension — Typed Storage Manager
 * Wraps chrome.storage.local with semantic helpers.
 * Also dual-writes legacy keys so existing content scripts remain compatible.
 * Must be imported AFTER config.js.
 */

"use strict";

const TrivisStorage = {
  /* ─────────────────────────── READ ─────────────────────────── */

  async getAll() {
    const keys = Object.values(TRIVIS_CONFIG.STORAGE);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (r) => resolve(r || {}));
      } catch (_) {
        resolve({});
      }
    });
  },

  async get(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(Array.isArray(keys) ? keys : [keys], (r) => resolve(r || {}));
      } catch (_) {
        resolve({});
      }
    });
  },

  async getLicenseKey() {
    const r = await this.get([TRIVIS_CONFIG.STORAGE.LICENSE_KEY]);
    return r[TRIVIS_CONFIG.STORAGE.LICENSE_KEY] || null;
  },

  async getSessionToken() {
    const r = await this.get([TRIVIS_CONFIG.STORAGE.SESSION_TOKEN]);
    return r[TRIVIS_CONFIG.STORAGE.SESSION_TOKEN]
      || (await this.get([TRIVIS_CONFIG.STORAGE.LEGACY_SESSION]))[TRIVIS_CONFIG.STORAGE.LEGACY_SESSION]
      || null;
  },

  async getHwid() {
    return getHwid(); // delegate to hwid.js
  },

  async isLicensed() {
    const r = await this.get([
      TRIVIS_CONFIG.STORAGE.LICENSE_KEY,
      TRIVIS_CONFIG.STORAGE.LEGACY_LIC_OK,
      TRIVIS_CONFIG.STORAGE.EXPIRES_AT,
      TRIVIS_CONFIG.STORAGE.IS_BANNED,
    ]);
    const hasKey = !!(r[TRIVIS_CONFIG.STORAGE.LICENSE_KEY]);
    const isOk   = r[TRIVIS_CONFIG.STORAGE.LEGACY_LIC_OK] === true || r[TRIVIS_CONFIG.STORAGE.LEGACY_LIC_OK] === "1";
    if (!hasKey || !isOk) return false;
    if (r[TRIVIS_CONFIG.STORAGE.IS_BANNED] === true) return false;
    if (r[TRIVIS_CONFIG.STORAGE.EXPIRES_AT]) {
      const t = Date.parse(r[TRIVIS_CONFIG.STORAGE.EXPIRES_AT]);
      if (t && Date.now() > t) return false;
    }
    return true;
  },

  /* ─────────────────────────── WRITE ─────────────────────────── */

  async saveCredentials(data) {
    /* data: { key, session, userName, plan, expiresAt, maxDevices, deviceId } */
    const S = TRIVIS_CONFIG.STORAGE;
    const patch = {
      // Primary keys
      [S.LICENSE_KEY]:    data.key,
      [S.SESSION_TOKEN]:  data.session || "",
      [S.USER_NAME]:      data.userName || "Trivis User",
      [S.PLAN]:           data.plan || "PRO",
      [S.EXPIRES_AT]:     data.expiresAt || null,
      [S.LAST_HEARTBEAT]: Date.now(),
      [S.IS_BANNED]:      false,
      [S.IS_LOCKED]:      false,
      [S.BAN_NOTICE]:     null,
      [S.UPDATE_REQUIRED]:false,

      // Legacy keys — content scripts read these
      [S.LEGACY_LIC_OK]:  true,
      [S.LEGACY_SESSION]: data.session || ("sess_" + Date.now()),
      [S.LEGACY_EXP]:     data.expiresAt || null,
      [S.LEGACY_NAME]:    data.userName || "Trivis User",

      // Zokys mirrors
      [S.ZOKYS_LIC_OK]:   true,
      [S.ZOKYS_SESSION]:  data.session || "",
    };
    if (data.deviceId) {
      patch[S.HWID] = data.deviceId;
      patch[S.DEVICE_ID] = data.deviceId;
    }
    return this._set(patch);
  },

  async saveLockState(_locked, _message) {
    const S = TRIVIS_CONFIG.STORAGE;
    return this._set({
      [S.IS_LOCKED]:       false,
      [S.LOCK_MESSAGE]:    "",
      [S.LEGACY_LOCK_FLAG]:false,
      [S.LEGACY_LOCK_MSG]: "",
      [S.ZOKYS_LOCK_FLAG]: false,
      [S.ZOKYS_LOCK_MSG]:  "",
    });
  },

  async saveBanState(banned, banNotice) {
    const S = TRIVIS_CONFIG.STORAGE;
    return this._set({
      [S.IS_BANNED]:  banned,
      [S.BAN_NOTICE]: banNotice || null,
      [S.LEGACY_LIC_OK]: !banned,
      [S.ZOKYS_LIC_OK]:  !banned,
    });
  },

  async saveHeartbeatResult(data) {
    /* data: server telemetry response */
    const S = TRIVIS_CONFIG.STORAGE;
    const patch = {
      [S.LAST_HEARTBEAT]: Date.now(),
      [S.LAST_CHECK]:     Date.now(),
      [S.IS_LOCKED]:       false,
      [S.LEGACY_LOCK_FLAG]:false,
      [S.ZOKYS_LOCK_FLAG]: false,
      [S.LOCK_MESSAGE]:    "",
      [S.LEGACY_LOCK_MSG]: "",
      [S.ZOKYS_LOCK_MSG]:  "",
    };
    if (typeof data.total_prompts === "number") patch[S.TOTAL_PROMPTS] = data.total_prompts;
    if (data.expires_at)  patch[S.EXPIRES_AT]  = data.expires_at;
    if (data.user_name)   patch[S.USER_NAME]   = data.user_name;
    if (data.plan)        patch[S.PLAN]        = data.plan;
    return this._set(patch);
  },

  async saveUpdateState(_updateRequired, _notice, latestVersion) {
    const S = TRIVIS_CONFIG.STORAGE;
    return this._set({
      [S.UPDATE_REQUIRED]: false,
      [S.UPDATE_NOTICE]:   null,
      [S.LATEST_VERSION]:  latestVersion || null,
    });
  },

  async clearLicense() {
    const S = TRIVIS_CONFIG.STORAGE;
    return new Promise((resolve) => {
      try {
        chrome.storage.local.remove([
          S.LICENSE_KEY, S.SESSION_TOKEN, S.USER_NAME, S.PLAN,
          S.EXPIRES_AT, S.IS_LOCKED, S.IS_BANNED, S.BAN_NOTICE,
          S.LOCK_MESSAGE, S.TOTAL_PROMPTS, S.LAST_HEARTBEAT, S.LAST_CHECK,
          S.UPDATE_REQUIRED, S.UPDATE_NOTICE, S.LATEST_VERSION,
          // Legacy cleanup
          S.LEGACY_LIC_OK, S.LEGACY_SESSION, S.LEGACY_EXP,
          S.LEGACY_LOCK_FLAG, S.ZOKYS_LIC_OK, S.ZOKYS_SESSION,
          S.ZOKYS_LOCK_FLAG,
        ], resolve);
      } catch (_) {
        resolve();
      }
    });
  },

  /* ────────────────────────── INTERNAL ──────────────────────── */

  _set(patch) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(patch, resolve);
      } catch (_) {
        resolve();
      }
    });
  },
};
