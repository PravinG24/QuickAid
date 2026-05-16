const sessionKey = "quickaid-session-v1";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const accountsStorageKey = "quickaid-accounts-v1";
const accessRequestsStorageKey = "quickaid-access-requests-v1";
const SYSTEM_ADMIN_EMAIL = "admin@campus.edu";
const DEFAULT_API_BASE = "http://localhost:7071";
const API_BASE = Object.prototype.hasOwnProperty.call(window, "QUICKAID_API_BASE")
  ? window.QUICKAID_API_BASE
  : DEFAULT_API_BASE;
const API_BASE_CONFIGURED = true;

const authHeading = document.querySelector(".login-page .entra-panel h1");
if (authHeading) authHeading.textContent = "Welcome back";

const ENTRA_TENANT_ID = String(window.QUICKAID_ENTRA_TENANT_ID || "").trim();
const ENTRA_CLIENT_ID = String(window.QUICKAID_ENTRA_CLIENT_ID || "").trim();
const ENTRA_API_SCOPE = String(window.QUICKAID_ENTRA_API_SCOPE || "").trim();
const ENTRA_REDIRECT_URI = String(window.QUICKAID_ENTRA_REDIRECT_URI || `${window.location.origin}/login.html`).trim();
let entraMsalInstance = null;

function saveSession(session) {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

function loadAccounts() {
  try {
    const raw = localStorage.getItem(accountsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(accountsStorageKey, JSON.stringify(Array.isArray(accounts) ? accounts : []));
}

function loadAccessRequests() {
  try {
    const raw = localStorage.getItem(accessRequestsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAccessRequests(requests) {
  localStorage.setItem(accessRequestsStorageKey, JSON.stringify(Array.isArray(requests) ? requests : []));
}

function setError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message || "";
}

function normalizeRole(value) {
  const role = String(value || "").toLowerCase();
  if (role === "admin" || role === "staff" || role === "user") return role;
  return "user";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized === SYSTEM_ADMIN_EMAIL;
}

function resolveRoleFromEmail(email, fallbackRole = "user") {
  if (isAdminEmail(email)) return "admin";
  return normalizeRole(fallbackRole);
}

function bindRolePreview(selectEl, previewEl) {
  if (!selectEl || !previewEl) return;
  const sync = () => {
    previewEl.dataset.role = normalizeRole(selectEl.value);
  };
  selectEl.addEventListener("change", sync);
  sync();
}

function toDashboard(session) {
  const role = normalizeRole(session?.role);
  window.location.href = role === "admin" ? "./admin.html" : "./dashboard.html";
}

function getEntraAdminScope() {
  if (!ENTRA_API_SCOPE) {
    throw new Error("Microsoft sign-in is not configured yet.");
  }
  return ENTRA_API_SCOPE;
}

function getEntraMsalInstance() {
  if (!window.msal?.PublicClientApplication) {
    throw new Error("Microsoft sign-in is unavailable. Reload the page or try again later.");
  }
  if (!ENTRA_TENANT_ID || !ENTRA_CLIENT_ID) {
    throw new Error("Microsoft sign-in is not configured yet.");
  }
  if (!entraMsalInstance) {
    entraMsalInstance = new window.msal.PublicClientApplication({
      auth: {
        clientId: ENTRA_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}`,
        redirectUri: ENTRA_REDIRECT_URI,
        navigateToLoginRequestUrl: false,
      },
      cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
      },
    });
  }
  return entraMsalInstance;
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return {};
  const parts = token.split(".");
  if (parts.length < 2) return {};
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function getTokenRoles(claims) {
  const rawRoles = claims?.roles ?? claims?.role;
  if (Array.isArray(rawRoles)) return rawRoles.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof rawRoles === "string" && rawRoles.trim()) return [rawRoles.trim()];
  return [];
}

function getTokenEmail(claims, account) {
  return normalizeEmail(claims?.preferred_username || claims?.email || claims?.upn || account?.username || "");
}

function getTokenName(claims, account, email) {
  return String(claims?.name || account?.name || email || "Microsoft User").trim();
}

function isAdminRoleClaim(claims) {
  return getTokenRoles(claims).some((role) => String(role).toLowerCase() === "admin");
}

function normalizeApprovalStatus(approvalLookup) {
  return String(approvalLookup?.request?.approvalStatus || approvalLookup?.approvalStatus || "")
    .trim()
    .toLowerCase();
}

function assertAdminApprovalStatus(approvalLookup) {
  const status = normalizeApprovalStatus(approvalLookup);
  if (status === "approved" || status === "active") return;
  if (status === "rejected") {
    throw new Error("Your admin access request was rejected. Contact the system admin.");
  }
  if (status === "pending") {
    throw new Error("Your admin request is still pending approval.");
  }
  if (status === "missing") {
    throw new Error("No admin approval request found for this account. Please register as admin first.");
  }
  throw new Error("Unable to confirm admin approval status right now. Please try again.");
}

async function loginWithMicrosoftAdmin() {
  const msalInstance = getEntraMsalInstance();
  const scope = getEntraAdminScope();
  const loginResult = await msalInstance.loginPopup({
    scopes: ["openid", "profile", "email", scope],
  });
  const account = loginResult.account || msalInstance.getAllAccounts()[0] || null;
  const tokenResult = await msalInstance.acquireTokenSilent({
    account,
    scopes: [scope],
  }).catch(async () => msalInstance.acquireTokenPopup({ account, scopes: [scope] }));
  const claims = decodeJwtPayload(tokenResult.accessToken || tokenResult.idToken || "");
  if (!isAdminRoleClaim(claims)) {
    throw new Error("Your account does not have the Admin app role.");
  }
  let approvalLookup = null;
  try {
    approvalLookup = await apiGet(
      "/api/approvals/admin?mine=true",
      tokenResult.accessToken || tokenResult.idToken || ""
    );
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("404") || message.toLowerCase().includes("not found")) {
      throw new Error("Admin approval service is not available yet. Please try again in a moment.");
    }
    throw new Error(message || "Failed to validate admin approval status.");
  }
  assertAdminApprovalStatus(approvalLookup);
  const email = getTokenEmail(claims, account);
  const name = getTokenName(claims, account, email);
  const session = {
    email,
    role: "admin",
    name,
    token: tokenResult.accessToken || tokenResult.idToken || loginResult.idToken || "",
    provider: "entra",
    prefs: { notifEmail: true, notifInApp: true },
  };
  saveSession(session);
  toDashboard(session);
}

async function apiPost(path, payload) {
  const headers = { "Content-Type": "application/json" };
  const functionKey = String(window.QUICKAID_FUNCTION_KEY || "").trim();
  if (functionKey) headers["x-functions-key"] = functionKey;
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_message || data?.message || data?.error || `Request failed (${response.status}).`);
  }
  return data;
}

async function apiGet(path, accessToken = "") {
  const headers = {};
  const functionKey = String(window.QUICKAID_FUNCTION_KEY || "").trim();
  if (functionKey) headers["x-functions-key"] = functionKey;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${API_BASE}${path}`, { method: "GET", headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_message || data?.message || data?.error || `Request failed (${response.status}).`);
  }
  return data;
}

async function loginWithBackend(email, password) {
  // modify from frontend: backend splits user/admin login into separate Azure Functions.
  try {
    return await apiPost("/api/user_login", { email, password });
  } catch (userError) {
    try {
      return await apiPost("/api/login/admin", { email, password });
    } catch {
      throw userError;
    }
  }
}

async function registerAccountWithBackend({ email, name, password, role }) {
  // modify from frontend: backend supports user/admin registration, while staff approval is frontend-only for now.
  if (role === "staff") throw new Error("Staff registration is disabled until backend supports staff accounts.");
  const path = role === "admin" ? "/api/register_admin" : "/api/register_user";
  return apiPost(path, { email, name, password });
}

function sessionFromBackend(data, fallback = {}) {
  return {
    email: normalizeEmail(data?.email || fallback.email),
    role: normalizeRole(data?.role || fallback.role || "user"),
    name: data?.name || fallback.name || "Portal User",
    token: data?.token || fallback.token || "",
    prefs: { notifEmail: true, notifInApp: true },
  };
}

/* Extra frontend-only function disabled: access request records have no backend route yet.
function createAccessRequestFromAccount(account) {
  const normalizedRole = normalizeRole(account?.role);
  const isAdminRequest = normalizedRole === "admin";
  return {
    teamId: isAdminRequest ? "admin-department" : "technical",
    requester: account.name || "Requester",
    email: account.email,
    department: isAdminRequest ? "Administration Office" : "IT Services",
    role: isAdminRequest ? "Admin" : "Staff",
    status: "pending",
    date: new Date().toLocaleString(),
    created_at: new Date().toISOString(),
  };
}
*/

/* Extra frontend-only function disabled: local account fallback is disabled in backend-first mode.
function upsertAccountRecord(payload) {
  const accounts = loadAccounts();
  const email = normalizeEmail(payload.email);
  const role = normalizeRole(payload.role);
  const idx = accounts.findIndex((item) => normalizeEmail(item.email) === email);
  const existing = idx >= 0 ? accounts[idx] : null;
  const next = {
    email,
    name: String(payload.name || existing?.name || "Portal User"),
    role,
    isSystemAdmin: role === "admin" && isAdminEmail(email),
    password: String(payload.password || existing?.password || ""),
    approvalStatus:
      role === "admin" && isAdminEmail(email)
        ? "approved"
        : role === "staff" || role === "admin"
        ? (payload.approvalStatus || existing?.approvalStatus || "pending")
        : "approved",
    updated_at: new Date().toISOString(),
    created_at: existing?.created_at || new Date().toISOString(),
  };
  if (idx >= 0) accounts[idx] = next;
  else accounts.push(next);
  saveAccounts(accounts);
  return next;
}
*/

/* Extra frontend-only function disabled: Microsoft Entra demo auth has no backend route yet.
function handleMicrosoftAuth(roleValue, emailValue = "microsoft.user@campus.edu") {
  const email = normalizeEmail(emailValue);
  const role = resolveRoleFromEmail(email, roleValue);
  const session = {
    email,
    role,
    name: "Microsoft User",
    prefs: { notifEmail: true, notifInApp: true },
  };
  saveSession(session);
  toDashboard(session);
}
*/

function bindInputShell(inputEl) {
  const shell = inputEl?.closest(".input-shell");
  if (!shell) return;
  const sync = () => {
    shell.classList.toggle("has-text", Boolean(String(inputEl.value || "").trim()));
  };
  inputEl.addEventListener("focus", () => shell.classList.add("has-focus"));
  inputEl.addEventListener("blur", () => shell.classList.remove("has-focus"));
  inputEl.addEventListener("input", sync);
  sync();
}

function bindPasswordToggle(toggleEl) {
  if (!toggleEl) return;
  const inputEl = document.getElementById(toggleEl.dataset.passwordToggle || "");
  if (!inputEl) return;

  const sync = () => {
    const isVisible = inputEl.type === "text";
    toggleEl.classList.toggle("is-visible", isVisible);
    toggleEl.setAttribute("aria-pressed", String(isVisible));
    toggleEl.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
  };

  toggleEl.addEventListener("click", () => {
    inputEl.type = inputEl.type === "password" ? "text" : "password";
    sync();
    inputEl.dispatchEvent(
      new CustomEvent("password-visibility-change", {
        detail: { isVisible: inputEl.type === "text" },
      })
    );
    inputEl.focus();
  });
  sync();
}

document.querySelectorAll("[data-password-toggle]").forEach(bindPasswordToggle);

function initCuteBear({
  bearId,
  leftEyeId,
  rightEyeId,
  lookInputId,
  passwordInputId,
}) {
  const bear = document.getElementById(bearId);
  const leftEye = document.getElementById(leftEyeId);
  const rightEye = document.getElementById(rightEyeId);
  const lookInput = document.getElementById(lookInputId);
  const passwordInput = document.getElementById(passwordInputId);

  if (!bear || !leftEye || !rightEye || !lookInput || !passwordInput) return;

  let isLooking = true;

  const resetEyes = () => {
    leftEye.style.transform = "translate(0, 0)";
    rightEye.style.transform = "translate(0, 0)";
  };

  const lookMode = () => {
    isLooking = true;
    bear.classList.remove("hide");
  };

  const hideMode = () => {
    isLooking = false;
    bear.classList.add("hide");
    resetEyes();
  };

  const normalMode = () => {
    isLooking = true;
    bear.classList.remove("hide");
    resetEyes();
  };

  lookInput.addEventListener("focus", lookMode);
  lookInput.addEventListener("blur", normalMode);
  passwordInput.addEventListener("password-visibility-change", (event) => {
    if (event.detail?.isVisible) hideMode();
    else normalMode();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isLooking) return;
    const rect = bear.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const x = Math.max(-5, Math.min(5, dx * 5));
    const y = Math.max(-3.5, Math.min(3.5, dy * 3.5));
    leftEye.style.transform = `translate(${x}px, ${y}px)`;
    rightEye.style.transform = `translate(${x}px, ${y}px)`;
  });
}

const loginForm = document.getElementById("loginPageForm");
if (loginForm) {
  const usernameEl = document.getElementById("loginUsername");
  const passwordEl = document.getElementById("loginPassword");
  const loginMicrosoftBtn = document.getElementById("loginMicrosoftBtn");
  bindInputShell(usernameEl);
  bindInputShell(passwordEl);
  initCuteBear({
    bearId: "loginBear",
    leftEyeId: "loginLeftEye",
    rightEyeId: "loginRightEye",
    lookInputId: "loginUsername",
    passwordInputId: "loginPassword",
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("loginUsernameError", "");
    setError("loginPasswordError", "");
    const username = String(usernameEl?.value || "").trim();
    const password = String(passwordEl?.value || "").trim();
    let hasError = false;
    if (!username) {
      setError("loginUsernameError", "Please enter your username.");
      hasError = true;
    }
    if (!password) {
      setError("loginPasswordError", "Password is required.");
      hasError = true;
    }
    if (hasError) return;

    const email = username.includes("@") ? username : `${username}@campus.edu`;

    try {
      const backendSession = await loginWithBackend(email, password);
      if (backendSession) {
        const session = sessionFromBackend(backendSession, { email, name: username });
        saveSession(session);
        toDashboard(session);
        return;
      }

      // Extra frontend-only local account fallback is disabled in backend-first mode.
    } catch (error) {
      setError("loginPasswordError", error.message || "Login failed.");
    }
  });

  loginMicrosoftBtn?.addEventListener("click", async () => {
    setError("loginUsernameError", "");
    setError("loginPasswordError", "");
    try {
      await loginWithMicrosoftAdmin();
    } catch (error) {
      setError("loginPasswordError", error.message || "Microsoft sign-in failed.");
    }
  });
}

const registerForm = document.getElementById("registerPageForm");
if (registerForm) {
  const nameEl = document.getElementById("registerName");
  const emailEl = document.getElementById("registerEmail");
  const passwordEl = document.getElementById("registerPassword");
  const roleEl = document.getElementById("registerRole");
  const approvalNoteEl = document.getElementById("registerApprovalNote");
  const registerMicrosoftBtn = document.getElementById("registerMicrosoftBtn");
  bindInputShell(nameEl);
  bindInputShell(emailEl);
  bindInputShell(passwordEl);
  initCuteBear({
    bearId: "registerBear",
    leftEyeId: "registerLeftEye",
    rightEyeId: "registerRightEye",
    lookInputId: "registerEmail",
    passwordInputId: "registerPassword",
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("registerNameError", "");
    setError("registerEmailError", "");
    setError("registerPasswordError", "");
    setError("registerRoleError", "");
    if (approvalNoteEl) {
      approvalNoteEl.textContent = "";
      approvalNoteEl.classList.add("hidden");
    }
    const name = String(nameEl?.value || "").trim();
    const email = String(emailEl?.value || "").trim();
    const password = String(passwordEl?.value || "").trim();
    const role = normalizeRole(String(roleEl?.value || "user"));
    let hasError = false;
    if (!name) {
      setError("registerNameError", "Name is required.");
      hasError = true;
    }
    if (!email || !emailRegex.test(email)) {
      setError("registerEmailError", "Please enter a valid email.");
      hasError = true;
    }
    if (!password) {
      setError("registerPasswordError", "Password is required.");
      hasError = true;
    } else if (password.length < 8) {
      setError("registerPasswordError", "Password must be at least 8 characters.");
      hasError = true;
    }
    if (!["user", "staff", "admin"].includes(role)) {
      setError("registerRoleError", "Role is required.");
      hasError = true;
    }
    if (hasError) return;

    let account;
    try {
      const backendAccount = await registerAccountWithBackend({ email, name, password, role });
      account = backendAccount ? { ...backendAccount, role, password } : null;
    } catch (error) {
      setError("registerEmailError", error.message || "Registration failed.");
      return;
    }

    if (role === "staff") {
      setError("registerRoleError", "Staff registration is disabled until backend supports staff accounts.");
      return;
    }

    if (role === "admin") {
      if (approvalNoteEl) {
        approvalNoteEl.textContent =
          account?.message || "Your admin request has been submitted. A pre-approved admin must approve it before you can sign in.";
        approvalNoteEl.classList.remove("hidden");
      }
      return;
    }

    // Extra frontend-only access approval request is disabled until backend has access request routes.
    /*
    const requests = loadAccessRequests();
    const exists = requests.some(
      (item) =>
        normalizeEmail(item.email) === normalizeEmail(account.email) &&
        String(item.role || "").toLowerCase() === role &&
        String(item.status || "").toLowerCase() === "pending"
    );
    if (!exists) {
      requests.unshift(createAccessRequestFromAccount(account));
      saveAccessRequests(requests);
    }
    */

    const session = {
      email: account.email,
      role: account.role,
      name: account.name,
      prefs: { notifEmail: true, notifInApp: true },
    };
    saveSession(session);
    toDashboard(session);
  });

  // Extra frontend-only Microsoft demo auth is disabled until backend supports Entra ID.
  // registerMicrosoftBtn?.addEventListener("click", () => {
  //   handleMicrosoftAuth("user");
  // });
}
