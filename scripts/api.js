/**
 * Trivis Extension — Admin Panel API Client
 * Resilient fetch wrapper for all public admin panel endpoints.
 * Must be imported AFTER config.js, hwid.js, and storage.js.
 */

"use strict";

const TrivisAPI = {

  /* ─────────────────────────────────────────────────────────────
     1. LICENSE VALIDATION & ACTIVATION
     POST /api/public/validate-license
     ───────────────────────────────────────────────────────────── */

  async validateLicense({ key, deviceId, name, workspace, version, recheck }) {
    const base = TRIVIS_CONFIG.LICENSE_API_BASE;
    const url  = base + TRIVIS_CONFIG.ENDPOINTS.VALIDATE_LICENSE;

    const body = {
      operation: recheck ? "check" : "activate",
      licenseKey: String(key || "").trim().toUpperCase(),
      productIdentifier: "browser-extension-core",
      deviceIdentifier: deviceId || await getHwid(),
    };
    return this._post(url, body);
  },

  /* Fallback alias route */
  async validateLicenseFallback(payload) {
    const base = TRIVIS_CONFIG.LICENSE_API_BASE;
    const url  = base + TRIVIS_CONFIG.ENDPOINTS.VALIDATE_LICENSE_ALT;
    return this._post(url, payload);
  },

  /* ─────────────────────────────────────────────────────────────
     2. TELEMETRY / HEARTBEAT / CHAT LOG
     POST /api/public/ext/telemetry
     ───────────────────────────────────────────────────────────── */

  async sendTelemetry({ key, session, deviceId, workspace, action, prompt, deviceName }) {
    const base = await resolveApiBaseAsync();
    const url  = base + TRIVIS_CONFIG.ENDPOINTS.TELEMETRY;

    const body = {
      key:         String(key || "").trim().toUpperCase(),
      session:     session || "",
      deviceId:    deviceId || await getHwid(),
      action:      action || "heartbeat",
      device_name: deviceName || "Trivis Device",
    };
    if (workspace) body.workspace  = String(workspace).slice(0, 100);
    if (prompt)    body.prompt     = String(prompt).slice(0, 4096);

    return this._post(url, body, 12000);
  },

  /* ─────────────────────────────────────────────────────────────
     3. EXTENSION VERSION & KILL-SWITCH CHECK
     GET /api/public/extension/version
     ───────────────────────────────────────────────────────────── */

  async checkExtensionVersion(extensionName) {
    const base = await resolveApiBaseAsync();
    const name = encodeURIComponent(extensionName || TRIVIS_CONFIG.EXTENSION_NAME);
    const url  = base + TRIVIS_CONFIG.ENDPOINTS.EXTENSION_VERSION_PATH + "?extension_name=" + name;
    return this._get(url);
  },

  /* ─────────────────────────────────────────────────────────────
     4. ENTITLEMENT & UPDATE VALIDATION
     POST /api/public/extension/validate
     ───────────────────────────────────────────────────────────── */

  async validateExtensionUpdate({ licenseKey, clientVersion, deviceId, extensionName }) {
    const base = await resolveApiBaseAsync();
    const url  = base + TRIVIS_CONFIG.ENDPOINTS.EXTENSION_VALIDATE;
    return this._post(url, {
      license_key:    String(licenseKey || "").trim().toUpperCase(),
      client_version: clientVersion || TRIVIS_CONFIG.EXTENSION_VERSION,
      device_id:      deviceId || await getHwid(),
      extension_name: extensionName || TRIVIS_CONFIG.EXTENSION_NAME,
    });
  },

  /* ─────────────────────────────────────────────────────────────
     5. EXTENSION STATUS (LOCK / BAN)
     POST /api/public/extension-status
     ───────────────────────────────────────────────────────────── */

  async fetchExtensionStatus(licenseKey) {
    const base = await resolveApiBaseAsync();
    const body = licenseKey ? { license_key: String(licenseKey).trim().toUpperCase() } : {};

    // Try primary, then fallback
    let data = await this._post(
      base + TRIVIS_CONFIG.ENDPOINTS.EXTENSION_STATUS, body, 12000
    ).catch(() => null);

    if (!data || data.ok === undefined) {
      data = await this._post(
        base + TRIVIS_CONFIG.ENDPOINTS.EXTENSION_STATUS_ALT, body, 12000
      ).catch(() => null);
    }
    return data;
  },

  /* ─────────────────────────────────────────────────────────────
     HTTP HELPERS
     ───────────────────────────────────────────────────────────── */

  async _post(url, body, timeoutMs) {
    const ctrl   = new AbortController();
    const ms     = timeoutMs || TRIVIS_CONFIG.FETCH_TIMEOUT_MS;
    const timer  = setTimeout(() => ctrl.abort(), ms);
    try {
      const resp = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
        signal:  ctrl.signal,
      });
      const data = await resp.json().catch(() => null);
      return this._normalizeResponse(resp, data);
    } catch (e) {
      return { _networkError: true, error: (e && e.name === "AbortError") ? "Timeout" : "Network error" };
    } finally {
      clearTimeout(timer);
    }
  },

  async _get(url, timeoutMs) {
    const ctrl  = new AbortController();
    const ms    = timeoutMs || TRIVIS_CONFIG.FETCH_TIMEOUT_MS;
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const resp = await fetch(url, {
        method:  "GET",
        headers: { "Accept": "application/json" },
        signal:  ctrl.signal,
      });
      const data = await resp.json().catch(() => null);
      return this._normalizeResponse(resp, data);
    } catch (e) {
      return { _networkError: true, error: (e && e.name === "AbortError") ? "Timeout" : "Network error" };
    } finally {
      clearTimeout(timer);
    }
  },

  _normalizeResponse(resp, data) {
    if (!data) data = {};
    data._httpStatus = resp.status;
    data._httpOk     = resp.ok;
    return data;
  },

  /* ─────────────────────────────────────────────────────────────
     RESPONSE CLASSIFIERS
     ───────────────────────────────────────────────────────────── */

  isBanned(data) {
    return !!(data && (data.banned === true || data.reason === "banned" || data.reason === "banned_ip"));
  },

  isDeviceLimitExceeded(data) {
    return !!(data && (
      data.reason === "device_limit_exceeded" || data.reason === "max_devices_reached"
    ));
  },

  isExpired(data) {
    return !!(data && data.reason === "expired");
  },

  isRevoked(data) {
    return !!(data && data.reason === "revoked");
  },

  isNetworkError(data) {
    return !!(data && data._networkError);
  },
};
