const sessionKey = "quickaid-session-v1";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const accountsStorageKey = "quickaid-accounts-v1";
const accessRequestsStorageKey = "quickaid-access-requests-v1";
const SYSTEM_ADMIN_EMAIL = "admin@campus.edu";
const API_BASE_CONFIGURED = Object.prototype.hasOwnProperty.call(window, "QUICKAID_API_BASE");
const API_BASE = API_BASE_CONFIGURED ? window.QUICKAID_API_BASE : "";

const authHeading = document.querySelector(".login-page .entra-panel h1");
if (authHeading) authHeading.textContent = "Welcome back👋";

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

async function apiPost(path, payload) {
  if (!API_BASE_CONFIGURED) return null;
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_message || data?.message || data?.error || `Request failed (${response.status}).`);
  }
  return data;
}

function sessionFromBackend(data, fallback = {}) {
  return {
    email: normalizeEmail(data?.email || fallback.email),
    role: normalizeRole(data?.role || fallback.role || "user"),
    name: data?.name || fallback.name || "Portal User",
    prefs: { notifEmail: true, notifInApp: true },
  };
}

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
  passwordInput.addEventListener("focus", hideMode);
  passwordInput.addEventListener("blur", normalMode);

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
  const loginAdminTestBtn = document.getElementById("loginAdminTestBtn");
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
      const backendSession = await apiPost("/api/user_login", { email, password });
      if (backendSession) {
        const session = sessionFromBackend(backendSession, { email, name: username });
        saveSession(session);
        toDashboard(session);
        return;
      }

      const accounts = loadAccounts();
      const existing = accounts.find((item) => normalizeEmail(item.email) === normalizeEmail(email));
      const resolvedRole = existing?.role || resolveRoleFromEmail(email, "user");
      if (
        !isAdminEmail(email) &&
        (resolvedRole === "staff" || resolvedRole === "admin") &&
        String(existing?.approvalStatus || "pending") !== "approved"
      ) {
        const status = String(existing?.approvalStatus || "pending").toLowerCase();
        setError(
          "loginUsernameError",
          status === "rejected"
            ? "Your access request was rejected. Please contact admin."
            : "Your account is pending approval. Please wait for admin approval."
        );
        return;
      }
      const session = {
        email,
        role: resolvedRole,
        name: existing?.name || username || "Portal User",
        prefs: { notifEmail: true, notifInApp: true },
      };
      saveSession(session);
      toDashboard(session);
    } catch (error) {
      setError("loginPasswordError", error.message || "Login failed.");
    }
  });

  loginMicrosoftBtn?.addEventListener("click", () => {
    handleMicrosoftAuth("user");
  });

  // REMOVE_IN_PRODUCTION: Temporary bypass for admin UI testing.
  loginAdminTestBtn?.addEventListener("click", () => {
    const session = {
      email: "admin@campus.edu",
      role: "admin",
      name: "Admin Test User",
      prefs: { notifEmail: true, notifInApp: true },
    };
    saveSession(session);
    toDashboard(session);
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
    }
    if (!["user", "staff", "admin"].includes(role)) {
      setError("registerRoleError", "Role is required.");
      hasError = true;
    }
    if (hasError) return;

    let account;
    try {
      const backendAccount = await apiPost("/api/register_user", { email, name, password, role });
      account = backendAccount ? { ...backendAccount, password } : null;
    } catch (error) {
      setError("registerEmailError", error.message || "Registration failed.");
      return;
    }

    if (!account) {
      account = upsertAccountRecord({
        email,
        name,
        role,
        password,
        approvalStatus: role === "user" ? "approved" : "pending",
      });
    }

    if (role === "staff" || role === "admin") {
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
      if (approvalNoteEl) {
        approvalNoteEl.textContent = "Registration submitted. Please wait for admin approval before login.";
        approvalNoteEl.classList.remove("hidden");
      }
      return;
    }

    const session = {
      email: account.email,
      role: account.role,
      name: account.name,
      prefs: { notifEmail: true, notifInApp: true },
    };
    saveSession(session);
    toDashboard(session);
  });

  registerMicrosoftBtn?.addEventListener("click", () => {
    handleMicrosoftAuth("user");
  });
}
