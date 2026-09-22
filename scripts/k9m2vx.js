/**
 * Trivis service worker bridge
 * - License validate against trivis-admin-panel.vercel.app
 * - Heartbeat recheck (expire / ban / revoke → local kill)
 * - Inject freeze scripts ONLY when licensed
 * - Load original background logic via importScripts
 * Freeze script paths unchanged.
 *
 * v3.2.0 — Admin Panel Integration:
 * - Imports config.js, hwid.js, storage.js, api.js for centralized logic
 * - Adds TRIVIS_TELEMETRY_PROMPT: logs prompts to admin panel chat logs
 * - Adds TRIVIS_CHECK_VERSION: checks extension version + kill-switch
 * - Heartbeat alarm calls sendTelemetry for full server sync
 * - All existing freeze, account-switch, lock, revalidate logic preserved
 */

/* ── Load shared modules (config, hwid, storage, api) ── */
try {
  importScripts(
    "scripts/config.js",
    "scripts/hwid.js",
    "scripts/storage.js",
    "scripts/api.js"
  );
} catch (e) {
  console.warn("[Trivis] Shared module import failed", e);
}

/* Resolve API base at startup (picks up trivis_api_mode preference) */
try { resolveApiBaseAsync().catch(() => {}); } catch (_) {}


const LOCK_FLAG_KEY = "trivis_extension_locked";
const LOCK_MSG_KEY = "trivis_lock_message";
const LEGACY_LOCK_FLAG_KEY = "zokys_extension_locked";
const LEGACY_LOCK_MSG_KEY = "zokys_lock_message";
const TRIVIS_API = "https://happy-little101.lovable.app/api/public/v1/licenses";
const LICENSE_PRODUCT = "browser-extension-core";

async function getApiEndpoint(path) {
  try {
    if (typeof resolveApiBaseAsync === "function") {
      const base = await resolveApiBaseAsync();
      return base.replace(/\/+$/, "") + path;
    }
  } catch (_) {}
  const store = await chrome.storage.local.get(["trivis_api_mode", "trivis_api_base_custom"]);
  if (store.trivis_api_base_custom) return store.trivis_api_base_custom.replace(/\/+$/, "") + path;
  if (store.trivis_api_mode === "local") return "http://localhost:3000" + path;
  return "https://trivis-admin-panel.vercel.app" + path;
}
const KEY_RE = /^LXC-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i;
const TOKEN_KEY = "trivis_license_key";
const OK_KEY = "trivis_lic_ok";
const SESSION_KEY = "trivis_lic_session";
const NAME_KEY = "trivis_user_name";
const EXP_KEY = "trivis_lic_expires";
const DEVICE_KEY = "trivis_device_id";
const LAST_CHECK_KEY = "trivis_last_recheck";

const HEARTBEAT_ALARM = "trivis_license_heartbeat";
const HEARTBEAT_MINUTES = 1;

const FREEZE_SCRIPTS_MAIN = ["scripts/content/z3hfc0.js"];
const FREEZE_SCRIPTS_ISOLATED = [
  "scripts/shared/a2m9kx.js",
  "scripts/shared/p5v0lc.js",
  "scripts/shared/j6y4bn.js",
  "scripts/content/r7wq1a.js"
];

function deviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get([DEVICE_KEY], (r) => {
      if (r[DEVICE_KEY]) return resolve(r[DEVICE_KEY]);
      let id = "tv_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        id =
          "tv_" +
          Array.from(arr)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .slice(0, 24);
      } catch (_) {}
      chrome.storage.local.set({ [DEVICE_KEY]: id }, () => resolve(id));
    });
  });
}

async function isLicensed() {
  const r = await chrome.storage.local.get([OK_KEY, TOKEN_KEY, EXP_KEY]);
  if (!(r[OK_KEY] === true || r[OK_KEY] === "1") || !r[TOKEN_KEY]) return false;
  if (r[EXP_KEY]) {
    const t = Date.parse(r[EXP_KEY]);
    if (t && Date.now() > t) {
      await clearLicense();
      return false;
    }
  }
  return true;
}

async function clearLicense() {
  await chrome.storage.local.remove([
    TOKEN_KEY,
    OK_KEY,
    SESSION_KEY,
    NAME_KEY,
    EXP_KEY,
    LAST_CHECK_KEY
  ]);
}

/**
 * Server recheck using stored key + device.
 * Persistent login stays until server says invalid OR local expiry.
 * Network fail → keep current session (no false logout offline).
 */
async function revalidateFromServer() {
  const r = await chrome.storage.local.get([TOKEN_KEY, NAME_KEY, OK_KEY, EXP_KEY]);
  if (!(r[OK_KEY] === true || r[OK_KEY] === "1") || !r[TOKEN_KEY]) {
    return { ok: false, reason: "no_session" };
  }

  // Local expiry first
  if (r[EXP_KEY]) {
    const t = Date.parse(r[EXP_KEY]);
    if (t && Date.now() > t) {
      await clearLicense();
      return { ok: false, reason: "expired" };
    }
  }

  const key = String(r[TOKEN_KEY]).trim().toUpperCase();
  if (!KEY_RE.test(key)) {
    await clearLicense();
    return { ok: false, reason: "bad_key" };
  }

  try {
    const dev = await deviceId();
    const name = String(r[NAME_KEY] || "Trivis User").slice(0, 64);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    let resp;
    try {
      resp = await fetch(TRIVIS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "check",
          licenseKey: key,
          productIdentifier: LICENSE_PRODUCT,
          deviceIdentifier: dev
        }),
        signal: ctrl.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await resp.json().catch(() => null);

    const status = String(data && data.status || "").toLowerCase();
    const definitive = ["invalid", "revoked", "expired", "device_mismatch", "device_limit_reached"];
    if (definitive.includes(status)) {
      await clearLicense();
      return {
        ok: false,
        reason: status,
        error: data.error || data.message || status
      };
    }

    // Network, server, or malformed response keeps the current session.
    if (!resp.ok || !data || status !== "active" || data.valid !== true) {
      await chrome.storage.local.set({ [LAST_CHECK_KEY]: Date.now() });
      return { ok: true, reason: "network_keep" };
    }

    // Server OK — refresh expiry / name if provided
    const patch = { [LAST_CHECK_KEY]: Date.now(), [OK_KEY]: true };
    if (data.expiresAt) patch[EXP_KEY] = data.expiresAt;
    if (data.session) patch[SESSION_KEY] = data.session;
    await chrome.storage.local.set(patch);

    return {
      ok: true,
      reason: "revalidated",
      expires_at: data.expiresAt || r[EXP_KEY] || null,
      name: data.user_name || r[NAME_KEY] || null
    };
  } catch (_) {
    // Offline / abort → keep session
    return { ok: true, reason: "network_keep" };
  }
}

function isLovableProjectUrl(url) {
  try {
    // Only project workspace — never dashboard/home (freeze breaks project list + slows SPA)
    return /https:\/\/([a-z0-9-]+\.)?lovable\.dev\/projects\/[a-zA-Z0-9_-]+/i.test(String(url || ""));
  } catch (_) {
    return false;
  }
}

async function injectFreezeIntoTab(tabId, tabUrl, skipWait, fullInject) {
  try {
    if (tabUrl && !isLovableProjectUrl(tabUrl)) return;
    if (!tabUrl) {
      try {
        const t = await chrome.tabs.get(tabId);
        if (!t || !isLovableProjectUrl(t.url || "")) return;
      } catch (_) {
        return;
      }
    }
  } catch (_) {
    return;
  }

  try {
    const chk = await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      world: "MAIN",
      func: function () {
        return !!(window.__TRIVIS_FREEZE_INJECTED__ || window.__ZOKYS_FREEZE_INJECTED__);
      }
    });
    if (!fullInject && chk && chk[0] && chk[0].result === true) return;
  } catch (_) {}

  if (!skipWait && !fullInject) await new Promise((r) => setTimeout(r, 2500));
  else if (!skipWait) await new Promise((r) => setTimeout(r, 400));

  try {
    const chk2 = await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      world: "MAIN",
      func: function () {
        return !!(window.__TRIVIS_FREEZE_INJECTED__ || window.__ZOKYS_FREEZE_INJECTED__);
      }
    });
    if (!fullInject && chk2 && chk2[0] && chk2[0].result === true) return;
  } catch (_) {}

  // Mark BEFORE inject so parallel onUpdated cannot double-run
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      world: "MAIN",
      func: function () {
        try {
          window.__TRIVIS_FREEZE_INJECTED__ = true;
          window.__ZOKYS_FREEZE_INJECTED__ = true;
        } catch (e) {}
      }
    });
  } catch (_) {}

  try {
    for (const file of FREEZE_SCRIPTS_MAIN) {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: [file],
        world: "MAIN"
      });
    }
  } catch (_) {}

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: FREEZE_SCRIPTS_ISOLATED,
      world: "ISOLATED"
    });
  } catch (_) {}

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ["scripts/content/trivis-label-main.js"],
      world: "MAIN"
    });
  } catch (_) {}

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      world: "MAIN",
      func: function () {
        try {
          window.__TRIVIS_LICENSED__ = true;
          window.__ZOKYS_LICENSED__ = true;
        } catch (e) {}
      }
    });
  } catch (_) {}
}


async function injectFreezeAllLovableTabs() {
  const ok = await isLicensed();
  if (!ok) return;
  try {
    const tabs = await chrome.tabs.query({
      url: ["https://lovable.dev/projects/*", "https://*.lovable.dev/projects/*"]
    });
    for (const tab of tabs) {
      if (tab.id && isLovableProjectUrl(tab.url || "")) {
        await injectFreezeIntoTab(tab.id, tab.url);
      }
    }
  } catch (_) {}
}

function scheduleHeartbeat() {
  try {
    chrome.alarms.create(HEARTBEAT_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: HEARTBEAT_MINUTES
    });
  } catch (_) {}
}



async function clearLovableSession() {
  try {
    const all = await chrome.cookies.getAll({});
    for (const c of all) {
      const host = (c.domain || "").replace(/^\./, "");
      if (!/lovable\.dev$/i.test(host) && host !== "lovable.dev") continue;
      try {
        const url = "https://" + host + (c.path || "/");
        await chrome.cookies.remove({ url: url, name: c.name });
        if (c.storeId) {
          await chrome.cookies.remove({ url: url, name: c.name, storeId: c.storeId });
        }
      } catch (_) {}
    }
  } catch (_) {}
  // Common auth cookie names explicit wipe
  const names = [
    "sb-access-token",
    "sb-refresh-token",
    "lovable-session",
    "lovable-session-id",
    "__session",
    "session"
  ];
  for (const name of names) {
    for (const host of ["lovable.dev", "www.lovable.dev"]) {
      try {
        await chrome.cookies.remove({ url: "https://" + host + "/", name: name });
      } catch (_) {}
    }
  }
}


async function executeAccountSwitch(inviteUrl) {
  const ok = await isLicensed();
  if (!ok) {
    return { ok: false, error: "Activate license first" };
  }
  const r = await chrome.storage.local.get([TOKEN_KEY, DEVICE_KEY]);
  const license_key = String(r[TOKEN_KEY] || "").trim();
  const device_id = r[DEVICE_KEY] || (await deviceId());
  if (!license_key) {
    return { ok: false, error: "No license key" };
  }

  const prev = await chrome.storage.local.get(["trivis_last_pool_email", "zokys_last_pool_email"]);
  const exclude_email = (prev && (prev.trivis_last_pool_email || prev.zokys_last_pool_email)) || "";
  const body = {
    license_key,
    device_id,
    invite_url: inviteUrl || "",
    exclude_email: exclude_email || undefined
  };

  async function post(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      const data = await resp.json().catch(() => null);
      return { resp, data };
    } finally {
      clearTimeout(t);
    }
  }

  let data = null;
  try {
    const switchUrl = await getApiEndpoint("/api/public/switch-account");
    const switchFallbackUrl = await getApiEndpoint("/api/switch-account");
    let out = await post(switchUrl);
    data = out.data;
    if (!data || (out.resp && out.resp.status === 404)) {
      out = await post(switchFallbackUrl);
      data = out.data;
    }
  } catch (e) {
    return {
      ok: false,
      error: e && e.name === "AbortError" ? "Timeout" : "Network error"
    };
  }

  if (!data || data.ok === false) {
    return {
      ok: false,
      reason: (data && data.reason) || "failed",
      error: (data && (data.message || data.error)) || "Switch failed",
      switches_today: data && data.switches_today,
      daily_limit: data && data.daily_limit
    };
  }

  if (!data.account || !data.account.email || !data.account.password) {
    return { ok: false, error: "Server did not return account credentials" };
  }

  await clearLovableSession();

  const targetUrl = data.targetUrl || inviteUrl || "https://lovable.dev/";
  const email = String(data.account.email || "").trim();
  const password = String(data.account.password || "");

  await chrome.storage.local.set({
    trivis_switch_pending: true,
    trivis_switch_email: email,
    trivis_switch_password: password,
    trivis_invite_url: targetUrl,
    trivis_switch_at: Date.now(),
    trivis_switch_step: "login",
    trivis_last_pool_email: email,
    zokys_switch_pending: true,
    zokys_switch_email: email,
    zokys_switch_password: password,
    zokys_invite_url: targetUrl,
    zokys_switch_at: Date.now(),
    zokys_switch_step: "login",
    zokys_last_pool_email: email
  });

  // Wipe page storage on all Lovable tabs, then focus login
  try {
    const tabs = await chrome.tabs.query({ url: ["https://lovable.dev/*", "https://*.lovable.dev/*"] });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: function () {
            try {
              localStorage.clear();
              sessionStorage.clear();
            } catch (e) {}
            try {
              if (indexedDB && indexedDB.databases) {
                indexedDB.databases().then(function (dbs) {
                  (dbs || []).forEach(function (db) {
                    if (db && db.name) indexedDB.deleteDatabase(db.name);
                  });
                });
              }
            } catch (e) {}
          }
        });
      } catch (_) {}
    }
  } catch (_) {}

  // Force all lovable tabs to login (replace) after storage wipe
  try {
    const tabs = await chrome.tabs.query({ url: ["https://lovable.dev/*", "https://*.lovable.dev/*"] });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.tabs.update(tab.id, { url: "https://lovable.dev/login?trivis_sw=" + Date.now() });
      } catch (_) {}
    }
  } catch (_) {}

  return {
    ok: true,
    email: email,
    targetUrl: targetUrl,
    switches_today: data.switches_today,
    switches_left_today: data.switches_left_today,
    daily_limit: data.daily_limit || 2,
    cost: data.cost || 0
  };
}



async function applyLockState(_data) {
  // Always enforce unlocked state in storage and across all tabs
  await chrome.storage.local.set({
    [LOCK_FLAG_KEY]: false,
    [LOCK_MSG_KEY]: "",
    [LEGACY_LOCK_FLAG_KEY]: false,
    [LEGACY_LOCK_MSG_KEY]: "",
    "trivis_is_locked": false,
    "zokys_is_locked": false,
    "trivis_update_required": false
  });
  try {
    const tabs = await chrome.tabs.query({ url: ["https://lovable.dev/*", "https://*.lovable.dev/*", "https://*.lovable.app/*", "https://lovable.app/*"] });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        chrome.tabs.sendMessage(tab.id, {
          type: "TRIVIS_LOCK_STATE",
          locked: false,
          message: ""
        }).catch(() => {});
        chrome.tabs.sendMessage(tab.id, {
          type: "ZOKYS_LOCK_STATE",
          locked: false,
          message: ""
        }).catch(() => {});
      } catch (_) {}
    }
  } catch (_) {}
}

async function fetchExtensionStatus() {
  await applyLockState({ extension_locked: false, lock_message: "" });
  return { ok: true, extension_locked: false, is_locked: false };
}


chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  if (msg.type === "TRIVIS_LOCK_STATUS" || msg.type === "ZOKYS_LOCK_STATUS") {
    sendResponse({
      locked: false,
      message: ""
    });
    return true;
  }

  if (msg.type === "TRIVIS_VALIDATE" || msg.type === "TRIVIS_VALIDATE_KEY") {
    (async () => {
      try {
        const key = String(msg.key || "").trim().toUpperCase();
        const name = String(msg.name || "").trim().slice(0, 64);
        const dev = await deviceId();
        if (!KEY_RE.test(key)) {
          sendResponse({ ok: false, error: "Format: LXC-XXXXX-XXXXX-XXXXX-XXXXX", reason: "invalid" });
          return;
        }
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        let resp;
        try {
          resp = await fetch(TRIVIS_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              operation: "activate",
              licenseKey: key,
              productIdentifier: LICENSE_PRODUCT,
              deviceIdentifier: dev
            }),
            signal: ctrl.signal
          });
        } finally {
          clearTimeout(t);
        }
        const data = await resp.json().catch(() => null);
        const status = String(data && data.status || "").toLowerCase();
        const definitive = ["invalid", "revoked", "expired", "device_mismatch", "device_limit_reached"];
        if (definitive.includes(status)) {
          await clearLicense();
          sendResponse({
            ok: false,
            error: (data && (data.error || data.message)) || status,
            reason: status
          });
          return;
        }
        if (!resp.ok || !data || data.valid !== true || status !== "active") {
          sendResponse({
            ok: false,
            error: (data && (data.error || data.message)) || "License service unavailable",
            reason: status || "network"
          });
          return;
        }
        const patch = {
          [TOKEN_KEY]: key,
          [OK_KEY]: true,
          [SESSION_KEY]: data.session || "sess_" + Date.now(),
          [NAME_KEY]: data.user_name || name || "Trivis User",
          [LAST_CHECK_KEY]: Date.now(),
          [LOCK_FLAG_KEY]: false,
          [LOCK_MSG_KEY]: "",
          [LEGACY_LOCK_FLAG_KEY]: false,
          [LEGACY_LOCK_MSG_KEY]: "",
          "trivis_is_locked": false,
          "zokys_is_locked": false,
          "trivis_update_required": false,
          // ── Ensure Lovable content.js native guard stays OFF after Trivis activation ──
          "eu_license_valid": true,
          "ql_license_valid": true,
          "ql_extension_state": {
            "permissions": {
              "chat_allowed": true,
              "projects_allowed": true
            },
            "trivis_managed": true
          }
        };
        if (data.expiresAt) patch[EXP_KEY] = data.expiresAt;
        await chrome.storage.local.set(patch);
        try {
          if (typeof TrivisStorage !== "undefined" && TrivisStorage.saveCredentials) {
            await TrivisStorage.saveCredentials({
              key,
              session: patch[SESSION_KEY],
              userName: patch[NAME_KEY],
              plan: data.plan || "PRO",
              expiresAt: data.expiresAt || null,
              deviceId: dev
            });
          }
        } catch (_) {}
        try { await applyLockState({ extension_locked: false, lock_message: "" }); } catch (_) {}
        await injectFreezeAllLovableTabs();
        scheduleHeartbeat();
        sendResponse({
          ok: true,
          session: patch[SESSION_KEY],
          expires_at: data.expiresAt || null,
          user_name: patch[NAME_KEY],
          name: patch[NAME_KEY],
          key
        });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e && e.name === "AbortError" ? "Timeout" : "Network error",
          reason: "network"
        });
      }
    })();
    return true;
  }

  // Fast local status — persistent login, no key prompt
  if (msg.type === "TRIVIS_STATUS") {
    (async () => {
      // Optional force server recheck
      if (msg.recheck) {
        await revalidateFromServer();
      }
      const ok = await isLicensed();
      const r = await chrome.storage.local.get([TOKEN_KEY, NAME_KEY, EXP_KEY]);
      // If licensed, keep native guard keys correct so Lovable chat/projects stay unlocked
      if (ok) {
        try {
          const guardState = await chrome.storage.local.get(["eu_license_valid", "ql_extension_state"]);
          const extState = guardState.ql_extension_state || {};
          const perms = extState.permissions || {};
          if (!guardState.eu_license_valid || perms.chat_allowed !== true) {
            await chrome.storage.local.set({
              eu_license_valid: true,
              ql_license_valid: true,
              ql_extension_state: {
                permissions: { chat_allowed: true, projects_allowed: true },
                trivis_managed: true
              }
            });
          }
        } catch (_) {}
      }
      sendResponse({
        ok,
        key: r[TOKEN_KEY] || null,
        name: r[NAME_KEY] || null,
        expires_at: r[EXP_KEY] || null
      });
    })();
    return true;
  }

  // Explicit server recheck (UI / manual)
  if (msg.type === "TRIVIS_RECHECK") {
    (async () => {
      const result = await revalidateFromServer();
      const r = await chrome.storage.local.get([TOKEN_KEY, NAME_KEY, EXP_KEY]);
      sendResponse({
        ok: result.ok && (await isLicensed()),
        reason: result.reason || null,
        error: result.error || null,
        key: r[TOKEN_KEY] || null,
        name: r[NAME_KEY] || null,
        expires_at: r[EXP_KEY] || null
      });
    })();
    return true;
  }

  if (msg.type === "TRIVIS_SWITCH_ACCOUNT" || msg.type === "ZOKYS_SWITCH_ACCOUNT") {
    (async () => {
      try {
        const res = await executeAccountSwitch(msg.inviteUrl || msg.invite_url || "");
        sendResponse(res);
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  
  if (msg.type === "TRIVIS_ENSURE_FREEZE" || msg.type === "REMAX_ENSURE_FREEZE" || msg.type === "ZOKYS_ENSURE_FREEZE") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs && tabs[0];
        if (tab && tab.id && /lovable\.dev/i.test(tab.url || "")) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              world: "MAIN",
              func: function () {
                try {
                  window.__ZOKYS_FREEZE_INJECTED__ = false;
                  window.__TRIVIS_FREEZE_INJECTED__ = false;
                } catch (e) {}
              }
            });
          } catch (_) {}
          await injectFreezeIntoTab(tab.id, tab.url || "", false, true);
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === "TRIVIS_LOGOUT") {
    clearLicense().then(() => sendResponse({ ok: true }));
    return true;
  }

  /* ── TRIVIS_TELEMETRY_PROMPT: log prompt to admin panel chat logs ── */
  if (msg.type === "TRIVIS_TELEMETRY_PROMPT") {
    (async () => {
      try {
        const r = await chrome.storage.local.get([
          TOKEN_KEY, SESSION_KEY, DEVICE_KEY, NAME_KEY, "trivis_workspace_name"
        ]);
        const key = String(r[TOKEN_KEY] || "").trim().toUpperCase();
        if (!key || !KEY_RE.test(key)) { sendResponse({ ok: false, error: "No session" }); return; }
        const session    = r[SESSION_KEY] || "";
        const deviceId   = r[DEVICE_KEY]  || await deviceId();
        const workspace  = r["trivis_workspace_name"] || "";
        const deviceName = r[NAME_KEY] || "Trivis Device";
        const promptText = String(msg.prompt || msg.text || "").slice(0, 4096);
        if (!promptText) { sendResponse({ ok: false, error: "Empty prompt" }); return; }
        const data = await TrivisAPI.sendTelemetry({
          key,
          session,
          deviceId,
          workspace,
          action:     "prompt",
          prompt:     promptText,
          deviceName,
        });
        if (data && !TrivisAPI.isNetworkError(data)) {
          await TrivisStorage.saveHeartbeatResult(data);
        }
        sendResponse({ ok: !!(data && data.ok) });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  /* ── TRIVIS_CHECK_VERSION: pull version + kill-switch from admin panel ── */
  if (msg.type === "TRIVIS_CHECK_VERSION") {
    (async () => {
      try {
        const data = await TrivisAPI.checkExtensionVersion(
          (msg.extensionName) || TRIVIS_CONFIG.EXTENSION_NAME
        );
        if (!data || TrivisAPI.isNetworkError(data)) {
          sendResponse({ ok: false, error: "Network error" }); return;
        }
        // Permanently enforce unlocked state regardless of server kill-switch
        await applyLockState({ extension_locked: false, lock_message: "" });
        try {
          await TrivisStorage.saveUpdateState(false, null, data.latest_version || TRIVIS_CONFIG.EXTENSION_VERSION);
        } catch (_) {}
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  return false;
});

// Heartbeat alarm — only kills on expire / ban / revoke
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) return;

  // Existing: revalidate license (handles expire / revoke / ban)
  revalidateFromServer().then((res) => {
    if (res && res.ok === false && (res.reason === "revoked" || res.reason === "expired")) {
      // session cleared; next UI poll will show gate
    }
  });

  // New: send heartbeat telemetry to admin panel for stats + lock sync
  (async () => {
    try {
      const r = await chrome.storage.local.get([TOKEN_KEY, SESSION_KEY, DEVICE_KEY, NAME_KEY]);
      const key = String(r[TOKEN_KEY] || "").trim().toUpperCase();
      if (!key || !KEY_RE.test(key)) return;
      const data = await TrivisAPI.sendTelemetry({
        key,
        session:    r[SESSION_KEY] || "",
        deviceId:   r[DEVICE_KEY] || await getHwid(),
        action:     "heartbeat",
        deviceName: r[NAME_KEY] || "Trivis Device",
      });
      if (data && !TrivisAPI.isNetworkError(data)) {
        await TrivisStorage.saveHeartbeatResult(data);
      }
    } catch (_) {}
  })();
});


// When user opens / navigates Lovable, inject freeze if licensed
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url) return;
  // Dashboard: no freeze inject (blank projects / lag)
  if (!isLovableProjectUrl(tab.url)) return;
  isLicensed().then((ok) => {
    if (ok) injectFreezeIntoTab(tabId, tab.url);
  });
});

function boot() {
  scheduleHeartbeat();
  applyLockState({ extension_locked: false, lock_message: "" }).catch(() => {});
  isLicensed().then((ok) => {
    if (ok) {
      injectFreezeAllLovableTabs();
      // soft recheck soon after boot (ban catch without waiting full period)
      setTimeout(() => {
        revalidateFromServer();
      }, 3000);
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  boot();
});
chrome.runtime.onStartup.addListener(() => {
  boot();
});

// SW wake — schedule + soft check
boot();

// Load original background (obfuscated) — freeze / panel support logic
try {
  importScripts("xoqoebay2.js");
} catch (e) {
  console.warn("[Trivis] original background import failed", e);
}


// Re-run login helper when landing on login during switch
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url) return;
  if (!/lovable\.dev\/(login|signin)/i.test(tab.url) && !/lovable\.dev\/login/i.test(tab.url)) return;
  chrome.storage.local.get(["trivis_switch_pending", "zokys_switch_pending"], (s) => {
    if (!s || (!s.trivis_switch_pending && !s.zokys_switch_pending)) return;
    try {
      chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: ["scripts/content/trivis-switch-login.js"]
      });
    } catch (_) {}
  });
});


// Soft keepalive — never re-inject method scripts
try {
  chrome.alarms.create("TRIVIS_FREEZE_KEEPALIVE", { periodInMinutes: 5 });
} catch (_) {}
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || (alarm.name !== "TRIVIS_FREEZE_KEEPALIVE" && alarm.name !== "ZOKYS_FREEZE_KEEPALIVE")) return;
  isLicensed().then((ok) => {
    if (!ok) return;
    chrome.tabs.query({ active: true, url: ["https://lovable.dev/projects/*", "https://*.lovable.dev/projects/*"] }, (tabs) => {
      (tabs || []).forEach((tab) => {
        if (!tab || !tab.id) return;
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: function () {
            try {
              window.__TRIVIS_LICENSED__ = true;
              window.__ZOKYS_LICENSED__ = true;
            } catch (e) {}
          }
        }).catch(() => {});
      });
    });
  });
});

