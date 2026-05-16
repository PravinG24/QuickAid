const DEFAULT_API_BASE = "http://localhost:7071";
const API_BASE = Object.prototype.hasOwnProperty.call(window, "QUICKAID_API_BASE")
  ? window.QUICKAID_API_BASE
  : DEFAULT_API_BASE;
const API_BASE_CONFIGURED = true;

const form = document.getElementById("ticketForm");
const submitBtn = document.getElementById("submitBtn");
const submitResult = document.getElementById("submitResult");
const trackForm = document.getElementById("trackForm");
const trackBtn = document.getElementById("trackBtn");
const ticketsResult = document.getElementById("ticketsResult");
const desc = document.getElementById("description");
const descCount = document.getElementById("descCount");
const tabButtons = document.querySelectorAll(".tab-btn");
const templateButtons = document.querySelectorAll(".chip[data-template]");
const statusFilter = document.getElementById("statusFilter");
const sortBy = document.getElementById("sortBy");
const subjectInput = document.getElementById("subject");
const kbList = document.getElementById("kbList");
const kbSuggestions = document.getElementById("kbSuggestions");
const kbPageList = document.getElementById("kbPageList");
const btnResetKbFeedback = document.getElementById("btnResetKbFeedback");
const ticketSearch = document.getElementById("ticketSearch");
const categoryFilter = document.getElementById("categoryFilter");
const priorityFilter = document.getElementById("priorityFilter");
const statusTabs = document.querySelectorAll(".status-tab[data-status]");
const attachmentInput = document.getElementById("attachment");
const attachmentInfo = document.getElementById("attachmentInfo");
const attachmentPreview = document.getElementById("attachmentPreview");
const attachmentDropzone = document.getElementById("attachmentDropzone");
const messageFromName = document.getElementById("messageFromName");
const editorToolButtons = document.querySelectorAll(".message-toolbar .tool-btn[data-format]");
const emojiPicker = document.getElementById("emojiPicker");
const draftHint = document.getElementById("draftHint");
const slaHint = document.getElementById("slaHint");
const ticketsSkeleton = document.getElementById("ticketsSkeleton");

function syncMessageFromName() {
  if (!messageFromName) return;
  const next = sanitize(form?.name?.value);
  messageFromName.textContent = next || "Microsoft User";
}

const btnSignIn = document.getElementById("btnSignIn");
const btnProfile = document.getElementById("btnProfile");
const btnLogout = document.getElementById("btnLogout");
const btnAdminPanel = document.getElementById("btnAdminPanel");
const sidebarDashboardBtn = document.getElementById("sidebarDashboardBtn");
const sidebarKnowledgeBtn = document.getElementById("sidebarKnowledgeBtn");
const sidebarLogoutBtn = document.getElementById("sidebarLogoutBtn");

// ─── User sidebar toggle ───
const userSidebar = document.querySelector(".sidebar");
const userSidebarToggleBtn = document.getElementById("userSidebarToggleBtn");
const mobileUserSidebarToggleBtn = document.getElementById("mobileUserSidebarToggleBtn");
const userSidebarOverlay = document.getElementById("userSidebarOverlay");
const userMobileMediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 980px)") : null;

function isUserMobileViewport() {
  if (userMobileMediaQuery) return userMobileMediaQuery.matches;
  return window.innerWidth <= 980;
}

function setUserSidebarState(isCollapsed, shouldPersist = true) {
  userSidebar?.classList.toggle("collapsed", isCollapsed);
  const expanded = String(!isCollapsed);
  userSidebarToggleBtn?.setAttribute("aria-expanded", expanded);
  mobileUserSidebarToggleBtn?.setAttribute("aria-expanded", expanded);

  const isMobile = isUserMobileViewport();
  if (userSidebarOverlay) {
    const showOverlay = isMobile && !isCollapsed;
    userSidebarOverlay.hidden = !showOverlay;
    userSidebarOverlay.classList.toggle("active", showOverlay);
  }
  document.body.classList.toggle("sidebar-mobile-open", isMobile && !isCollapsed);

  if (shouldPersist) {
    localStorage.setItem("userSidebarCollapsed", String(isCollapsed));
  }
}

(function initUserSidebarState() {
  const saved = localStorage.getItem("userSidebarCollapsed");
  const shouldOpen = saved === "false" && !isUserMobileViewport();
  setUserSidebarState(!shouldOpen, false);
})();

function toggleUserSidebar() {
  const isNowCollapsed = !userSidebar || !userSidebar.classList.contains("collapsed") ? true : false;
  setUserSidebarState(isNowCollapsed);
}

userSidebarToggleBtn?.addEventListener("click", toggleUserSidebar);
mobileUserSidebarToggleBtn?.addEventListener("click", toggleUserSidebar);
userSidebarOverlay?.addEventListener("click", () => setUserSidebarState(true, false));

const handleUserViewportChange = () => {
  const isCollapsed = userSidebar?.classList.contains("collapsed") ?? true;
  setUserSidebarState(isCollapsed, false);
};

if (userMobileMediaQuery) {
  if (typeof userMobileMediaQuery.addEventListener === "function") {
    userMobileMediaQuery.addEventListener("change", handleUserViewportChange);
  } else if (typeof userMobileMediaQuery.addListener === "function") {
    userMobileMediaQuery.addListener(handleUserViewportChange);
  }
} else {
  window.addEventListener("resize", handleUserViewportChange);
}

const statusBanner = document.getElementById("statusBanner");
const quickMetrics = document.querySelector(".quick-metrics");

const btnInlineViewDetailPage = document.getElementById("btnInlineViewDetailPage");
const ticketInlinePanel = document.getElementById("ticketInlinePanel");
const ticketInlineEmpty = document.getElementById("ticketInlineEmpty");
const ticketInlineContent = document.getElementById("ticketInlineContent");
const inlineDetailSubject = document.getElementById("inlineDetailSubject");
const inlineDetailTicketId = document.getElementById("inlineDetailTicketId");
const inlineDetailStatus = document.getElementById("inlineDetailStatus");
const inlineDetailPriority = document.getElementById("inlineDetailPriority");
const inlineDetailCategory = document.getElementById("inlineDetailCategory");
const inlineDetailLocation = document.getElementById("inlineDetailLocation");
const inlineDetailUpdated = document.getElementById("inlineDetailUpdated");
const inlineDetailDescription = document.getElementById("inlineDetailDescription");

const profileModal = document.getElementById("profileModal");
const profileForm = document.getElementById("profileForm");
const profileEmail = document.getElementById("profileEmail");
const notifEmail = document.getElementById("notifEmail");
const notifInApp = document.getElementById("notifInApp");
const btnNotifications = document.getElementById("btnNotifications");
const notifDropdown = document.getElementById("notifDropdown");
const notifBadge = document.getElementById("notifBadge");
const notifUnreadCount = document.getElementById("notifUnreadCount");
const notifList = document.getElementById("notifList");
const btnMarkAllRead = document.getElementById("btnMarkAllRead");

// Notifications storage
let currentUserEmail = "";
let currentUserNotifications = [];

const createFormWrap = document.getElementById("createFormWrap");
const btnNewTicket = document.getElementById("btnNewTicket");
const btnCloseCreate = document.getElementById("btnCloseCreate");
const btnCancelCreate = document.getElementById("btnCancelCreate");
const btnNewTicketTop = document.getElementById("btnNewTicketTop");
const panels = {
  submit: document.getElementById("submitPanel"),
  track: document.getElementById("trackPanel"),
  knowledge: document.getElementById("knowledgeBasePanel"),
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const safeTextRegex = /^[^<>]*$/;
const allowedStatuses = ["New", "InProgress", "Resolved", "Closed"];
const priorityOrder = { Low: 1, Medium: 2, High: 3, Urgent: 4 };
const draftStorageKey = "quickaid-ticket-draft-v1";

let activeStatusTab = "All";
const tabToStatus = {
  All: "All",
  Open: "New",
  InProgress: "InProgress",
  Resolved: "Resolved",
};

const tabCountAll = document.getElementById("tabCountAll");
const tabCountOpen = document.getElementById("tabCountOpen");
const tabCountInProgress = document.getElementById("tabCountInProgress");
const tabCountResolved = document.getElementById("tabCountResolved");

const statOpen = document.getElementById("statOpen");
const statInProgress = document.getElementById("statInProgress");
const statResolved = document.getElementById("statResolved");
const statTotal = document.getElementById("statTotal");

// Frontend-only mock tickets are disabled in backend-first mode.
const mockTickets = [];
let lastLoadedTickets = [];
const ticketCacheStorageKey = "quickaid-ticket-cache-v1";

const studentSessionLabel = document.getElementById("studentSessionLabel");

function persistTicketCache(items) {
  try {
    localStorage.setItem(ticketCacheStorageKey, JSON.stringify(Array.isArray(items) ? items : []));
  } catch {
    // no-op: storage full or unavailable
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitize(value) {
  return String(value || "").trim();
}

function setTextContent(el, value) {
  if (el) el.textContent = String(value ?? "");
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  timeStyle: "short",
});

function formatDateTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "N/A";
  return dateTimeFormatter.format(date);
}

function formatTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "N/A";
  return timeFormatter.format(date);
}

function setFieldError(id, message) {
  const el = document.getElementById(`${id}Error`);
  if (el) el.textContent = message;
}

function clearFormErrors() {
  [
    "category",
    "name",
    "email",
    "department",
    "subject",
    "description",
    "attachment",
    "consent",
    "trackEmail",
  ].forEach((f) => setFieldError(f, ""));
}

function showSubmitResult(type, message) {
  if (!submitResult) return;
  submitResult.className = `result ${type}`;
  submitResult.textContent = message;
  submitResult.classList.remove("hidden");
}

function hideSubmitResult() {
  if (!submitResult) return;
  submitResult.classList.add("hidden");
}

function statusBadgeClass(status) {
  if (!status) return "badge-new";
  return `badge-${status.toLowerCase()}`;
}

function mapSafeStatus(status) {
  const normalized = normalizeTicketStatus(status);
  return allowedStatuses.includes(normalized) ? normalized : "New";
}

function prettyStatus(status) {
  if (status === "New") return "Open";
  if (status === "InProgress") return "In Progress";
  return status;
}

// modify from frontend: keep UI status labels compatible with backend's current "Open" value.
function normalizeTicketStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "open") return "New";
  if (value === "in progress" || value === "inprogress") return "InProgress";
  if (value === "resolved") return "Resolved";
  if (value === "closed") return "Closed";
  if (allowedStatuses.includes(status)) return status;
  return "New";
}

// modify from frontend: backend currently accepts only IT/HR/Finance/Operations/General.
function toBackendCategory(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("it") || normalized.includes("network") || normalized.includes("device")) return "IT";
  if (normalized.includes("hr")) return "HR";
  if (normalized.includes("finance") || normalized.includes("billing")) return "Finance";
  if (normalized.includes("facility") || normalized.includes("operation")) return "Operations";
  return "General";
}

function ticketMatchesCategoryFilter(ticket, filterValue) {
  // modify from frontend: backend category values are broader than the UI's assigned-team labels.
  if (!filterValue || filterValue === "All") return true;
  const ticketCategory = String(ticket.category || ticket.department || "").trim();
  return ticketCategory === filterValue || toBackendCategory(ticketCategory) === toBackendCategory(filterValue);
}

// modify from frontend: submit_ticket requires title/category; UI keeps subject/department for display.
function toBackendTicketPayload(payload) {
  const backendPayload = {
    email: payload.email,
    title: payload.subject,
    description: payload.description,
    category: toBackendCategory(payload.category || payload.department || payload.request_type),
  };
  if (payload.image) backendPayload.image = payload.image;
  return backendPayload;
}

function validateTicketPayload(payload) {
  const errors = {};
  if (!payload.request_type) errors.category = "Category is required.";
  if (!payload.name) errors.name = "Name is required.";
  if (!payload.email) errors.email = "Email is required.";
  else if (!emailRegex.test(payload.email)) errors.email = "Enter a valid email.";
  if (!payload.category) errors.department = "Department is required.";
  if (!payload.subject) errors.subject = "Subject is required.";
  if (payload.subject.length > 120) errors.subject = "Subject must be 120 chars or less.";
  if (!payload.description) errors.description = "Description is required.";
  if (payload.description.length > 2000)
    errors.description = "Description must be 2000 chars or less.";
  if (!safeTextRegex.test(payload.subject) || !safeTextRegex.test(payload.description)) {
    errors.description = "Please remove unsupported characters like < or >.";
  }
  return errors;
}

function saveDraft() {
  const draft = {
    category: form.category.value,
    name: form.name.value,
    email: form.email.value,
    department: form.department?.value || "",
    subject: form.subject.value,
    location: form.location.value,
    description: form.description.value,
    consent: form.consent.checked,
    savedAt: Date.now(),
  };
  localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  const savedTime = formatTime(draft.savedAt);
  setTextContent(draftHint, `Draft auto-saved at ${savedTime}.`);
}

function loadDraft() {
  const raw = localStorage.getItem(draftStorageKey);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== "object") return;
    form.category.value = draft.category || draft.requestType || "";
    form.name.value = draft.name || "";
    form.email.value = draft.email || "";
    if (form.department) form.department.value = draft.department || draft.assignTo || "";
    if (form.priority) form.priority.value = "Medium";
    form.subject.value = draft.subject || "";
    form.location.value = draft.location || "";
    form.description.value = draft.description || "";
    form.consent.checked = Boolean(draft.consent);
    setTextContent(descCount, String((draft.description || "").length));
    setTextContent(
      draftHint,
      draft.savedAt ? `Draft restored from ${formatDateTime(draft.savedAt)}.` : "Draft restored."
    );
    setTextContent(slaHint, "Priority will be assigned by admin triage after review.");
  } catch {
    // ignore invalid draft payload
  }
}

function clearDraft() {
  localStorage.removeItem(draftStorageKey);
  setTextContent(draftHint, "Draft cleared.");
}

function currentIsoTime() {
  return new Date().toISOString();
}

function randomTicketId() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `QKA-${yyyy}-${rand}`;
}

async function submitTicket(payload) {
  // Backend-first mode: POST /api/submit_ticket is the only create path.
  const response = await fetch(`${API_BASE}/api/submit_ticket`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Correlation-Id": crypto.randomUUID(),
    },
    body: JSON.stringify(toBackendTicketPayload(payload)),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const msg = error?.error_message || error?.error || "Unable to submit ticket. Please try again.";
    throw new Error(msg);
  }

  const result = await response.json();
  return normalizeTicketRecord({ ...payload, ...result });
}

async function getTicketsByEmail(email) {
  // Backend-first mode: GET /api/get_ticket is the requester ticket list source.
  const response = await fetch(
    `${API_BASE}/api/get_ticket?email=${encodeURIComponent(email)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Correlation-Id": crypto.randomUUID(),
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const msg = error?.error_message || error?.error || "Unable to retrieve tickets right now.";
    throw new Error(msg);
  }

  return response.json();
}

async function getNotificationsByEmail(email) {
  // Backend-first mode: GET /api/notifications is the notification list source.
  const response = await fetch(
    `${API_BASE}/api/notifications?email=${encodeURIComponent(email)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Correlation-Id": crypto.randomUUID(),
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const msg = error?.error_message || error?.error || "Unable to retrieve notifications.";
    throw new Error(msg);
  }

  return response.json();
}

async function markNotificationAsRead(notificationId, email) {
  // Backend-first mode: PATCH /api/notifications/{notificationId}/read marks notification as read.
  const response = await fetch(
    `${API_BASE}/api/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Correlation-Id": crypto.randomUUID(),
      },
      body: JSON.stringify({ email }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const msg = error?.error_message || error?.error || "Unable to mark notification as read.";
    throw new Error(msg);
  }

  return response.json();
}

function renderTickets(items) {
  ticketsResult.innerHTML = "";
  if (!items.length) {
    ticketsResult.innerHTML =
      '<div class="ticket-card">No tickets are currently linked to this account.</div>';
    return;
  }

  items.forEach((t) => {
    const status = mapSafeStatus(t.status);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "ticket-row";
    row.dataset.ticketId = t.ticket_id || "";
    row.setAttribute("aria-label", `Open ticket ${t.ticket_id || "N/A"}`);

    const dueLabel = computeSlaDueLabel(t);
    const updatedStr = formatDateTime(t.updated_at || t.submitted_at || Date.now());

    const priorityRaw = String(t.priority || "Medium");
    const priorityKey =
      priorityRaw.toLowerCase() === "urgent"
        ? "high"
        : priorityRaw.toLowerCase() || "medium";

    row.innerHTML = `
      <div class="ticket-card-top">
        <div class="ticket-card-left">
          <div class="ticket-card-id">${escapeHtml(t.ticket_id || "N/A")}</div>
          <span class="badge ${statusBadgeClass(status)}">${prettyStatus(status)}</span>
          <span class="priority-pill priority-${escapeHtml(priorityKey)}">${escapeHtml(
      priorityRaw
    )}</span>
        </div>
        <div class="ticket-card-right">
          <div class="ticket-view">Ticket Preview</div>
        </div>
      </div>

      <div class="ticket-card-subject">
        <strong>${escapeHtml(t.subject || t.title || "No subject")}</strong>
      </div>

      <div class="ticket-card-meta">
        <span class="muted">${escapeHtml(t.category || "General Inquiry")}</span>
        <span class="muted">•</span>
        <span class="muted">${escapeHtml(updatedStr)}</span>
      </div>

      <div class="ticket-card-bottom">
        <div class="ticket-sla">${escapeHtml(dueLabel)}</div>
      </div>
    `;

    row.addEventListener("click", () => openTicketDetails(t));
    ticketsResult.appendChild(row);
  });
}

function normalizeTicketRecord(source) {
  const item = source || {};
  const ticketId = item.ticket_id || item.ticketId || item.id || "";
  const createdAt = item.created_at || item.createdAt || item.submitted_at || item.updated_at || item.updatedAt || currentIsoTime();
  const updatedAt = item.updated_at || item.updatedAt || item.submitted_at || item.created_at || item.createdAt || currentIsoTime();
  return {
    ...item,
    ticket_id: ticketId,
    ticketId,
    subject: item.subject || item.title || "No subject",
    title: item.title || item.subject || "No subject",
    status: normalizeTicketStatus(item.status),
    submitted_at: item.submitted_at || createdAt,
    created_at: createdAt,
    updated_at: updatedAt,
    createdAt,
    updatedAt,
  };
}

function applyStatusFilter() {
  const activeStatus = tabToStatus[activeStatusTab] || "All";
  const q = sanitize(ticketSearch?.value || "").toLowerCase();
  const cat = categoryFilter?.value || "All";
  const pri = priorityFilter?.value || "All";

  // Update tab counts based on status only (before other filters).
  const counts = {
    All: lastLoadedTickets.length,
    Open: lastLoadedTickets.filter((t) => mapSafeStatus(t.status) === "New").length,
    InProgress: lastLoadedTickets.filter((t) => mapSafeStatus(t.status) === "InProgress").length,
    Resolved: lastLoadedTickets.filter((t) => mapSafeStatus(t.status) === "Resolved").length,
  };
  if (tabCountAll) tabCountAll.textContent = String(counts.All);
  if (tabCountOpen) tabCountOpen.textContent = String(counts.Open);
  if (tabCountInProgress) tabCountInProgress.textContent = String(counts.InProgress);
  if (tabCountResolved) tabCountResolved.textContent = String(counts.Resolved);

  if (statOpen) statOpen.textContent = String(counts.Open);
  if (statInProgress) statInProgress.textContent = String(counts.InProgress);
  if (statResolved) statResolved.textContent = String(counts.Resolved);
  if (statTotal) statTotal.textContent = String(counts.All);

  let filtered = [...lastLoadedTickets];
  if (activeStatus !== "All") {
    filtered = filtered.filter((ticket) => mapSafeStatus(ticket.status) === activeStatus);
  }
  if (cat && cat !== "All") {
    filtered = filtered.filter((ticket) => ticketMatchesCategoryFilter(ticket, cat));
  }
  if (pri && pri !== "All") {
    filtered = filtered.filter((ticket) => {
      const p = String(ticket.priority || "").toLowerCase();
      return p === pri.toLowerCase();
    });
  }
  if (q) {
    filtered = filtered.filter((t) => {
      const subject = String(t.subject || "").toLowerCase();
      const ticketId = String(t.ticket_id || "").toLowerCase();
      return subject.includes(q) || ticketId.includes(q);
    });
  }

  // Sorting: keep stable and predictable (updated desc like portal UIs).
  filtered.sort((a, b) => {
    const aMs = new Date(a.updated_at || a.submitted_at || 0).getTime();
    const bMs = new Date(b.updated_at || b.submitted_at || 0).getTime();
    return bMs - aMs;
  });

  renderTickets(filtered);
}

function openTrackPanel() {
  if (panels?.submit) panels.submit.classList.remove("active");
  if (panels?.knowledge) panels.knowledge.classList.remove("active");
  if (panels?.track) panels.track.classList.add("active");
  statusBanner?.classList.remove("hidden");
  quickMetrics?.classList.remove("hidden");
  tabButtons.forEach((b) => b.classList.remove("active"));
  const trackTabBtn = document.querySelector('.tab-btn[data-tab="track"]');
  if (trackTabBtn) trackTabBtn.classList.add("active");
}

function setActiveSidebarItem(activeKey) {
  sidebarDashboardBtn?.classList.toggle("sidebar-item-active", activeKey === "dashboard");
  sidebarKnowledgeBtn?.classList.toggle("sidebar-item-active", activeKey === "knowledge");
  sidebarDashboardBtn?.setAttribute("data-active", activeKey === "dashboard" ? "true" : "false");
  sidebarKnowledgeBtn?.setAttribute("data-active", activeKey === "knowledge" ? "true" : "false");
}

function openKnowledgeBasePanel() {
  if (panels?.submit) panels.submit.classList.remove("active");
  if (panels?.track) panels.track.classList.remove("active");
  if (panels?.knowledge) panels.knowledge.classList.add("active");
  statusBanner?.classList.add("hidden");
  quickMetrics?.classList.add("hidden");
  renderKnowledgeBasePage();
}

function showSubmittedTicketTemporarily(ticket, requesterEmail) {
  if (!ticket) return;
  const normalized = normalizeTicketRecord({
    ...ticket,
    email: ticket.email || requesterEmail || "",
    updated_at: ticket.updated_at || ticket.submitted_at || currentIsoTime(),
    submitted_at: ticket.submitted_at || currentIsoTime(),
  });
  const withoutSameId = lastLoadedTickets.filter((t) => String(t.ticket_id || "") !== String(normalized.ticket_id || ""));
  lastLoadedTickets = [normalized, ...withoutSameId];
  persistTicketCache(lastLoadedTickets);
  applyStatusFilter();
}

function mergeSubmittedTicketWithFetchedTickets(submittedTicket, fetchedTickets, requesterEmail) {
  const normalizedSubmitted = normalizeTicketRecord({
    ...submittedTicket,
    email: submittedTicket?.email || requesterEmail || "",
  });
  const normalizedFetched = Array.isArray(fetchedTickets) ? fetchedTickets.map(normalizeTicketRecord) : [];
  const submittedId = String(normalizedSubmitted.ticket_id || "");
  const existsInFetched = submittedId
    ? normalizedFetched.some((ticket) => String(ticket.ticket_id || "") === submittedId)
    : false;
  return existsInFetched ? normalizedFetched : [normalizedSubmitted, ...normalizedFetched];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInlineFormatting(value) {
  return escapeHtml(value)
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

function renderDescriptionFormatting(value) {
  const text = String(value || "No additional description provided.");
  return text
    .split(/\r?\n/)
    .map((line) => {
      const bullet = line.match(/^\s*-\s+(.+)$/);
      if (bullet) return `<span class="description-line description-bullet">&bull; ${renderInlineFormatting(bullet[1])}</span>`;
      if (!line.trim()) return '<span class="description-line description-empty">&nbsp;</span>';
      return `<span class="description-line">${renderInlineFormatting(line)}</span>`;
    })
    .join("");
}

function getSlaMsByPriority(priority) {
  const p = String(priority || "Medium").toLowerCase();
  if (p === "urgent") return 1 * 60 * 60 * 1000;
  if (p === "high") return 2 * 60 * 60 * 1000;
  if (p === "low") return 8 * 60 * 60 * 1000;
  return 4 * 60 * 60 * 1000;
}

function computeSlaDueLabel(ticket) {
  const submittedAt = ticket.submitted_at || ticket.created_at || ticket.updated_at || new Date().toISOString();
  const submittedMs = new Date(submittedAt).getTime();
  if (Number.isNaN(submittedMs)) return "SLA due soon";

  const status = mapSafeStatus(ticket.status);
  if (status === "Resolved" || status === "Closed") return "SLA closed";

  const dueMs = submittedMs + getSlaMsByPriority(ticket.priority);
  const diffMs = dueMs - Date.now();
  if (diffMs <= 0) return "SLA overdue";

  const mins = Math.max(0, Math.floor(diffMs / (60 * 1000)));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `Due in ${h}h ${m}m`;
  return `Due in ${m}m`;
}

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove("hidden");
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add("hidden");
}

function openTicketDetails(ticket) {
  const safeTicketId = String(ticket?.ticket_id || ticket?.ticketId || ticket?.id || "");
  const normalizedTicket = {
    ...ticket,
    ticket_id: safeTicketId,
    ticketId: safeTicketId,
  };
  const status = mapSafeStatus(ticket.status);
  const prRaw = String(ticket.priority || "Medium");
  const pLower = prRaw.toLowerCase();
  const prKey = pLower === "urgent" ? "high" : pLower;
  const normalized =
    prKey === "low" || prKey === "high" ? prKey : "medium";
  const updatedAt = ticket.updated_at || ticket.submitted_at || Date.now();

  if (
    ticketInlinePanel &&
    ticketInlineEmpty &&
    ticketInlineContent &&
    inlineDetailSubject &&
    inlineDetailTicketId &&
    inlineDetailStatus &&
    inlineDetailPriority &&
    inlineDetailCategory &&
    inlineDetailLocation &&
    inlineDetailUpdated &&
    inlineDetailDescription
  ) {
    ticketInlineEmpty.classList.add("hidden");
    ticketInlineContent.classList.remove("hidden");

    inlineDetailSubject.textContent = ticket.subject || "No subject";
    inlineDetailTicketId.textContent = safeTicketId ? `#${safeTicketId}` : "";
    inlineDetailStatus.className = `badge ${statusBadgeClass(status)}`;
    inlineDetailStatus.textContent = prettyStatus(status);
    inlineDetailPriority.className = `detail-priority-pill priority-${normalized}`;
    inlineDetailPriority.textContent = prRaw;
    inlineDetailCategory.textContent = `Department: ${ticket.category || "General Inquiry"}`;
    inlineDetailLocation.textContent = `Location: ${ticket.location || "Not provided"}`;
    inlineDetailUpdated.textContent = `Updated: ${formatDateTime(updatedAt)}`;
    inlineDetailDescription.innerHTML = renderDescriptionFormatting(normalizedTicket.description);
  }

  // Open the full ticket page from the inline summary panel.
  // Desktop: keep inline preview panel. Small screens: go to full detail page.
  const hasInlinePreview = Boolean(ticketInlinePanel);
  const isDesktop = window.matchMedia("(min-width: 981px)").matches;
  if (!hasInlinePreview || !isDesktop) {
    const ticketId = encodeURIComponent(safeTicketId);
    window.location.href = `./ticket-detail.html?ticketId=${ticketId}`;
  }
  if (btnInlineViewDetailPage) {
    btnInlineViewDetailPage.onclick = () => {
      const ticketId = encodeURIComponent(safeTicketId);
      window.location.href = `./ticket-detail.html?ticketId=${ticketId}`;
    };
  }
}

const sessionKey = "quickaid-session-v1";
function loadSession() {
  const raw = localStorage.getItem(sessionKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveSession(session) {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

function ensureDemoSession() {
  const existing = loadSession();
  if (existing?.email) return existing;
  const demo = {
    email: "sarah.johnson@school.edu",
    role: "Staff",
    name: "Sarah Johnson",
    prefs: { notifEmail: true, notifInApp: true },
  };
  saveSession(demo);
  return demo;
}

function seedDemoTickets(email) {
  if (mockTickets.length) return;
  const now = Date.now();
  const mk = (overrides) => ({
    ticket_id: randomTicketId(),
    status: "New",
    submitted_at: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
    created_at: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updated_at: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
    request_type: "Incident",
    name: "Sarah Johnson",
    email,
    category: "IT Support",
    priority: "High",
    subject: "Projector not working in Room 203",
    location: "Room 203",
    description:
      "The projector in classroom 203 is not displaying any image. The power light is on but no signal detected.",
    department: "IT",
    assignedTo: "Mike Chen",
    comments: [
      {
        by: "IT Support",
        text: "Thanks for reporting. We’re investigating and will update you shortly.",
        at: new Date(now - 1000 * 60 * 60 * 10).toISOString(),
      },
    ],
    timeline: [
      { label: "Ticket created", at: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString() },
      { label: "Assigned to technician", at: new Date(now - 1000 * 60 * 60 * 30).toISOString() },
      { label: "Status changed to In Progress", at: new Date(now - 1000 * 60 * 60 * 22).toISOString() },
    ],
    ...overrides,
  });

  mockTickets.push(
    mk({ status: "InProgress", priority: "High", category: "IT Support" }),
    mk({
      status: "New",
      priority: "Medium",
      category: "Facilities",
      subject: "Air conditioner leaking - Block B Level 3",
      description: "Water is dripping from the AC unit. Please advise maintenance.",
      assignedTo: "Facilities Desk",
    }),
    mk({
      status: "Resolved",
      priority: "Low",
      category: "Academic Admin",
      subject: "Password reset request",
      description: "Need password reset for portal access.",
      assignedTo: "Academic Admin Desk",
    })
  );
}

function updateHeaderAuthUi() {
  const session = loadSession();
  const signedIn = Boolean(session && session.email);
  const role = String(session?.role || "user").toLowerCase();
  const isAdmin = signedIn && role === "admin";
  document.body.dataset.role = ["user", "admin", "staff"].includes(role) ? role : "user";
  btnSignIn?.classList.toggle("hidden", signedIn);
  btnProfile?.classList.add("hidden");
  btnLogout?.classList.toggle("hidden", !signedIn);
  sidebarLogoutBtn?.classList.toggle("hidden", !signedIn);
  btnNotifications?.classList.remove("hidden");
  btnAdminPanel?.classList.toggle("hidden", !isAdmin);
  if (studentSessionLabel) {
    studentSessionLabel.textContent = signedIn
      ? `Signed in as ${session.email}`
      : "Not signed in";
  }
  if (!signedIn) closeNotifDropdown();
}

// ─────────────────────────────────
// Notifications dropdown wiring
// ─────────────────────────────────
function openNotifDropdown() {
  if (!notifDropdown) return;
  notifDropdown.classList.remove("hidden");
  btnNotifications?.setAttribute("aria-expanded", "true");
}

function closeNotifDropdown() {
  if (!notifDropdown) return;
  notifDropdown.classList.add("hidden");
  btnNotifications?.setAttribute("aria-expanded", "false");
}

function wireNotificationsUi() {
  if (!btnNotifications || !notifDropdown) return;

  // Initial render (unread count + list)
  renderNotifDropdown();

  btnNotifications.addEventListener("click", () => {
    const isOpen = notifDropdown && !notifDropdown.classList.contains("hidden");
    if (isOpen) {
      closeNotifDropdown();
    } else {
      renderNotifDropdown(); // refresh counts in case of state changes
      openNotifDropdown();
    }
  });

  btnMarkAllRead?.addEventListener("click", () => {
    markAllNotifAsRead();
    closeNotifDropdown();
  });

  // Click outside to close.
  document.addEventListener("click", (e) => {
    if (!notifDropdown || notifDropdown.classList.contains("hidden")) return;
    const target = e.target;
    if (!target) return;
    if (btnNotifications.contains(target)) return;
    if (notifDropdown.contains(target)) return;
    closeNotifDropdown();
  });
}

wireNotificationsUi();

/* Extra frontend-only function disabled: profile preferences have no backend route yet.
function openProfileModal() {
  if (!profileModal) return;
  const session = loadSession();
  if (profileEmail && session?.email) profileEmail.textContent = `Signed in as ${session.email}`;
  const prefs = session?.prefs || {};
  if (notifEmail) notifEmail.checked = Boolean(prefs.notifEmail);
  if (notifInApp) notifInApp.checked = Boolean(prefs.notifInApp);
  openModal(profileModal);
}
*/

function validateAttachment() {
  if (!attachmentInput || !attachmentInfo) return true;
  setFieldError("attachment", "");
  attachmentInfo.textContent = "";
  if (attachmentPreview) {
    attachmentPreview.classList.add("hidden");
    attachmentPreview.innerHTML = "";
  }
  const files = Array.from(attachmentInput.files || []);
  if (!files.length) return true;
  if (files.length > 1) {
    setFieldError("attachment", "Attach one image only.");
    return false;
  }
  const file = files[0];
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(String(file.type || ""))) {
    setFieldError("attachment", "Image must be JPEG, PNG, GIF, or WEBP.");
    return false;
  }
  const maxBytes = 1 * 1024 * 1024;
  if (file.size > maxBytes) {
    setFieldError("attachment", "Image must be smaller than 1MB.");
    return false;
  }
  attachmentInfo.textContent = `Selected: ${file.name} (${Math.ceil(file.size / 1024)} KB)`;
  if (attachmentPreview) {
    const reader = new FileReader();
    reader.onload = () => {
      attachmentPreview.innerHTML = `
        <img src="${String(reader.result)}" alt="Attachment preview" />
        <div class="filemeta">${escapeHtml(file.name)}</div>
      `;
      attachmentPreview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }
  return true;
}

function readImageForBackend(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read selected image."));
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const commaIndex = dataUrl.indexOf(",");
      const data = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
      resolve({
        filename: file.name,
        mimetype: file.type || "application/octet-stream",
        data,
      });
    };
    reader.readAsDataURL(file);
  });
}

function replaceSelection(textarea, replacer) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const original = textarea.value || "";
  const selected = original.slice(start, end);
  const { text, caretOffset } = replacer(selected);
  textarea.value = `${original.slice(0, start)}${text}${original.slice(end)}`;
  const nextCaret = typeof caretOffset === "number" ? start + caretOffset : start + text.length;
  textarea.focus();
  textarea.setSelectionRange(nextCaret, nextCaret);
  setTextContent(descCount, textarea.value.length);
  saveDraft();
}

const emojiChoices = [
  "😀",
  "😄",
  "😁",
  "😎",
  "🥳",
  "🤩",
  "🙂",
  "😉",
  "😊",
  "🤗",
  "👍",
  "👏",
  "🙏",
  "💪",
  "🔥",
  "⭐",
  "✅",
  "❗",
  "📌",
  "💡",
  "🛠️",
  "📎",
  "📷",
  "🧾",
];

function closeEmojiPicker() {
  if (!emojiPicker) return;
  emojiPicker.classList.add("hidden");
}

function openEmojiPicker() {
  if (!emojiPicker) return;
  emojiPicker.classList.remove("hidden");
}

function toggleEmojiPicker() {
  if (!emojiPicker) return;
  emojiPicker.classList.toggle("hidden");
}

function applyEditorAction(action) {
  if (!desc) return;
  if (action === "emoji") {
    toggleEmojiPicker();
    return;
  }
  closeEmojiPicker();
  if (action === "bold") {
    replaceSelection(desc, (selected) => {
      const val = selected || "bold text";
      return { text: `**${val}**`, caretOffset: selected ? undefined : 2 + val.length };
    });
    return;
  }
  if (action === "italic") {
    replaceSelection(desc, (selected) => {
      const val = selected || "italic text";
      return { text: `*${val}*`, caretOffset: selected ? undefined : 1 + val.length };
    });
    return;
  }
  if (action === "strike") {
    replaceSelection(desc, (selected) => {
      const val = selected || "text";
      return { text: `~~${val}~~`, caretOffset: selected ? undefined : 2 + val.length };
    });
    return;
  }
  if (action === "bullet") {
    replaceSelection(desc, (selected) => {
      const lines = (selected || "List item").split("\n").map((line) => `- ${line}`);
      return { text: lines.join("\n") };
    });
    return;
  }
  if (action === "link") {
    replaceSelection(desc, (selected) => {
      const val = selected || "link text";
      const isUrl = /^https?:\/\/\S+$/i.test(val);
      const text = isUrl ? `[link text](${val})` : `[${val}](https://)`;
      return { text, caretOffset: isUrl ? 10 : 3 + val.length };
    });
  }
}

function renderEmojiPicker() {
  if (!emojiPicker) return;
  emojiPicker.innerHTML = emojiChoices
    .map(
      (emoji) =>
        `<button type="button" class="emoji-picker-btn" data-emoji="${emoji}" aria-label="Insert ${emoji}">${emoji}</button>`
    )
    .join("");
}

const kbFeedbackStorageKey = "quickaid-kb-feedback-v1";
const knowledgeArticles = [
  {
    id: "kb-wifi-campus",
    keywords: ["wifi", "wi-fi", "internet", "network", "disconnect"],
    title: "Campus Wi-Fi troubleshooting guide",
    faqs: [
      {
        q: "Why does campus Wi-Fi keep disconnecting every few minutes?",
        a: "This usually happens when device roaming switches between nearby access points. Forget the network, reconnect, and disable aggressive battery optimization for Wi-Fi.",
      },
      {
        q: "How do I confirm if the issue is device-specific or area-specific?",
        a: "Test with one more device in the same location. If both fail, report building, floor, and nearest room so network support can inspect the access point health.",
      },
      {
        q: "What should I include in my ticket for faster resolution?",
        a: "Include device type, operating system, exact error message, and first observed time. Add screenshots of network diagnostics if available.",
      },
    ],
    helped: 0,
    notHelped: 0,
  },
  {
    id: "kb-facilities-aircond",
    keywords: ["aircond", "air conditioner", "facilities", "leak", "cooling"],
    title: "Facilities issue report checklist",
    faqs: [
      {
        q: "What information is required for an air conditioning issue?",
        a: "Provide location, affected room, unit condition (no cooling, leaking, noise), and whether the issue is constant or intermittent.",
      },
      {
        q: "Should I submit one ticket for multiple rooms?",
        a: "Create separate tickets per room or unit. This helps facilities assign the right technician and track completion accurately.",
      },
      {
        q: "Can I attach photos to speed up repair?",
        a: "Yes. Add clear photos showing leak points, panel indicators, or thermostat readings to help pre-diagnose parts and tools needed.",
      },
    ],
    helped: 0,
    notHelped: 0,
  },
  {
    id: "kb-portal-login",
    keywords: ["portal", "login", "password", "account", "mfa"],
    title: "Student portal access recovery steps",
    faqs: [
      {
        q: "I reset my password but still cannot log in. What next?",
        a: "Wait 3-5 minutes for directory sync, clear browser cache, and retry in an incognito window. Ensure the latest reset link was used.",
      },
      {
        q: "How can I fix MFA prompt not appearing?",
        a: "Confirm your authenticator app push permissions are enabled and device time is automatic. Then retry sign-in from a trusted network.",
      },
      {
        q: "When should I submit a support ticket?",
        a: "Submit if login fails after reset + cache clear + MFA checks. Include account type, exact error text, and timestamp of the failed attempt.",
      },
    ],
    helped: 0,
    notHelped: 0,
  },
  {
    id: "kb-printer-queue",
    keywords: ["printer", "print", "queue", "paper", "toner"],
    title: "Printer support and queue reset guide",
    faqs: [
      {
        q: "Why does my print job stay stuck in queue?",
        a: "The queue may be locked by a previous failed job. Cancel pending jobs, restart print spooler, and resend one test page.",
      },
      {
        q: "How do I report a shared printer outage?",
        a: "Include printer ID, location, error code on panel, and whether copying/scanning still works. This helps route to the right support team.",
      },
      {
        q: "What if prints are faded or missing colors?",
        a: "Run nozzle/toner diagnostics first. If quality remains poor, submit a ticket with sample output photo for consumable replacement.",
      },
    ],
    helped: 0,
    notHelped: 0,
  },
];

function loadKbFeedbackState() {
  try {
    const raw = localStorage.getItem(kbFeedbackStorageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveKbFeedbackState(state) {
  try {
    localStorage.setItem(kbFeedbackStorageKey, JSON.stringify(state || {}));
  } catch {
    // no-op for storage errors
  }
}

function getArticleFeedbackCounts(article, state) {
  const saved = state?.[article.id];
  return {
    helped: Number(saved?.helped ?? article.helped ?? 0),
    notHelped: Number(saved?.notHelped ?? article.notHelped ?? 0),
    votedChoice: String(saved?.votedChoice || ""),
  };
}

function renderKnowledgeBaseCards(targetList, articles, feedbackState) {
  if (!targetList) return;
  targetList.innerHTML = "";
  articles.forEach((article) => {
    const li = document.createElement("li");
    li.className = "kb-article-card";
    const counts = getArticleFeedbackCounts(article, feedbackState);
    const hasVoted = Boolean(counts.votedChoice);
    li.innerHTML = `
      <div class="kb-article-head">
        <strong>${escapeHtml(article.title)}</strong>
        <div class="kb-feedback-stats">
          <span>Helped: <b>${counts.helped}</b></span>
          <span>Not helped: <b>${counts.notHelped}</b></span>
        </div>
      </div>
      <div class="kb-faq-list">
        ${article.faqs
          .map(
            (faq) => `
          <details class="kb-faq-item">
            <summary>${escapeHtml(faq.q)}</summary>
            <p>${escapeHtml(faq.a)}</p>
          </details>
        `
          )
          .join("")}
      </div>
      <div class="kb-feedback-actions">
        <span>Did this article solve your problem?</span>
        <button
          type="button"
          class="kb-feedback-btn yes${counts.votedChoice === "helped" ? " is-selected" : ""}"
          data-kb-id="${escapeHtml(article.id)}"
          data-kb-vote="helped"
          ${hasVoted ? "disabled" : ""}
        >Yes, it helped</button>
        <button
          type="button"
          class="kb-feedback-btn no${counts.votedChoice === "notHelped" ? " is-selected" : ""}"
          data-kb-id="${escapeHtml(article.id)}"
          data-kb-vote="notHelped"
          ${hasVoted ? "disabled" : ""}
        >No, still need help</button>
        ${hasVoted ? '<span class="kb-feedback-note">Feedback recorded for this article.</span>' : ""}
      </div>
    `;
    targetList.appendChild(li);
  });
}

function updateKnowledgeSuggestions() {
  const query = sanitize(subjectInput.value).toLowerCase();
  kbList.innerHTML = "";
  if (!query) {
    kbSuggestions.querySelector(".kb-empty").style.display = "block";
    return;
  }
  kbSuggestions.querySelector(".kb-empty").style.display = "none";
  const feedbackState = loadKbFeedbackState();
  const matches = knowledgeArticles
    .filter((article) => article.keywords.some((k) => query.includes(k)))
    .slice(0, 5);
  if (!matches.length) {
    const li = document.createElement("li");
    li.textContent = "No direct match found. Continue submitting your ticket.";
    kbList.appendChild(li);
    return;
  }
  renderKnowledgeBaseCards(kbList, matches, feedbackState);
}

function renderKnowledgeBasePage() {
  const feedbackState = loadKbFeedbackState();
  renderKnowledgeBaseCards(kbPageList, knowledgeArticles, feedbackState);
}

function handleKbFeedbackVote(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const btn = target.closest(".kb-feedback-btn");
  if (!(btn instanceof HTMLButtonElement)) return;
  const articleId = String(btn.dataset.kbId || "");
  const voteType = String(btn.dataset.kbVote || "");
  if (!articleId || !["helped", "notHelped"].includes(voteType)) return;
  const feedbackState = loadKbFeedbackState();
  const current = feedbackState[articleId] || { helped: 0, notHelped: 0, votedChoice: "" };
  if (current.votedChoice) return;
  current[voteType] = Number(current[voteType] || 0) + 1;
  current.votedChoice = voteType;
  feedbackState[articleId] = current;
  saveKbFeedbackState(feedbackState);
  updateKnowledgeSuggestions();
  renderKnowledgeBasePage();
  if (voteType === "notHelped") {
    setActiveSidebarItem("dashboard");
    openCreateModal();
  }
}

["name", "email", "category", "department", "subject", "description", "trackEmail"].forEach((fieldId) => {
  const input = document.getElementById(fieldId);
  if (!input) return;
  input.addEventListener("blur", () => {
    if (input.value && input.value.trim()) setFieldError(fieldId, "");
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormErrors();
  hideSubmitResult();

  const payload = {
    request_type: sanitize(form.category.value),
    name: sanitize(form.name.value),
    email: sanitize(form.email.value),
    category: sanitize(form.category.value),
    department: sanitize(form.category.value),
    assigned_to: sanitize(form.category.value),
    subject: sanitize(form.subject.value),
    location: sanitize(form.location.value),
    description: sanitize(form.description.value),
  };

  const errors = validateTicketPayload(payload);
  if (!form.consent.checked) errors.consent = "Please confirm the ticket information.";
  if (!validateAttachment()) errors.attachment = "Attachment validation failed.";
  Object.entries(errors).forEach(([field, msg]) => setFieldError(field, msg));
  if (Object.keys(errors).length) return;

  submitBtn.disabled = true;
  setTextContent(submitBtn, "Submitting...");

  try {
    const selectedImage = Array.from(attachmentInput?.files || [])[0] || null;
    if (selectedImage) payload.image = await readImageForBackend(selectedImage);
    const result = await submitTicket(payload);
    showSubmittedTicketTemporarily(result, payload.email);
    showSubmitResult(
      "success",
      `Success: Ticket ${result.ticket_id} submitted. Current status: ${
        result.status || "New"
      }.`
    );
    form.reset();
    setTextContent(descCount, "0");
    setTextContent(attachmentInfo, "");
    if (attachmentPreview) attachmentPreview.classList.add("hidden");
    clearDraft();
    getTicketsByEmail(payload.email)
      .then((data) => {
        lastLoadedTickets = mergeSubmittedTicketWithFetchedTickets(result, data?.tickets, payload.email);
        persistTicketCache(lastLoadedTickets);
        applyStatusFilter();
      })
      .catch(() => {
        showSubmittedTicketTemporarily(result, payload.email);
      });
    setTimeout(() => {
      closeCreateFormWrap({ keepResult: true });
      openTrackPanel();
    }, 700);
    setTimeout(hideSubmitResult, 3200);
  } catch (error) {
    showSubmitResult("error", error.message);
  } finally {
    submitBtn.disabled = false;
    setTextContent(submitBtn, "Create");
  }
});

trackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFieldError("trackEmail", "");
  ticketsResult.innerHTML = "";
  if (ticketsSkeleton) ticketsSkeleton.classList.remove("hidden");

  const email = sanitize(trackForm.trackEmail.value);
  if (!email) {
    setFieldError("trackEmail", "Email is required.");
    if (ticketsSkeleton) ticketsSkeleton.classList.add("hidden");
    return;
  }
  if (!emailRegex.test(email)) {
    setFieldError("trackEmail", "Enter a valid email.");
    if (ticketsSkeleton) ticketsSkeleton.classList.add("hidden");
    return;
  }

  trackBtn.disabled = true;
  trackBtn.textContent = "Searching...";
  try {
    // Store current user email for notifications
    currentUserEmail = email;
    
    // Fetch tickets and notifications in parallel
    const ticketsData = await getTicketsByEmail(email);
    const notificationsData = await getNotificationsByEmail(email);
    
    lastLoadedTickets = Array.isArray(ticketsData.tickets) ? ticketsData.tickets.map(normalizeTicketRecord) : [];
    persistTicketCache(lastLoadedTickets);
    
    // Store notifications
    currentUserNotifications = Array.isArray(notificationsData.notifications) ? notificationsData.notifications : [];
    
    // Update UI
    renderNotifDropdown();
    applyStatusFilter();
  } catch (error) {
    lastLoadedTickets = [];
    currentUserNotifications = [];
    currentUserEmail = "";
    ticketsResult.innerHTML = `<div class="ticket-card">${escapeHtml(error.message)}</div>`;
  } finally {
    if (ticketsSkeleton) ticketsSkeleton.classList.add("hidden");
    trackBtn.disabled = false;
    trackBtn.textContent = "Find Tickets";
  }
});

desc.addEventListener("input", () => {
  setTextContent(descCount, desc.value.length);
  saveDraft();
});

const templateMap = {
  wifi: {
    category: "Incident",
    department: "IT Support",
    subject: "Unable to connect to campus Wi-Fi",
    description:
      "I cannot connect to campus Wi-Fi. Device: [phone/laptop], Location: [building/room], Time started: [time], Error shown: [message].",
  },
  aircond: {
    category: "Incident",
    department: "Facilities",
    subject: "Air conditioner not working",
    description:
      "Air conditioner appears faulty. Location: [building/room], When observed: [time], Current condition: [not cooling/leaking/no power].",
  },
  portal: {
    category: "ServiceRequest",
    department: "Academic Admin",
    subject: "Student portal login issue",
    description:
      "Unable to access student portal. Account type: [student/staff], Time started: [time], Error message: [message], Steps already tried: [details].",
  },
};

templateButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.template;
    const tpl = templateMap[key];
    if (!tpl) return;
    form.category.value = tpl.category || "Incident";
    if (form.department) form.department.value = tpl.department || "";
    form.subject.value = tpl.subject;
    form.description.value = tpl.description;
    setTextContent(descCount, form.description.value.length);
    hideSubmitResult();
    updateKnowledgeSuggestions();
    saveDraft();
    if (createFormWrap) {
      createFormWrap.classList.remove("hidden");
      createFormWrap.setAttribute("aria-hidden", "false");
    }
  });
});

if (ticketSearch) {
  ticketSearch.addEventListener("input", applyStatusFilter);
}
if (categoryFilter) {
  categoryFilter.addEventListener("change", applyStatusFilter);
}
if (priorityFilter) {
  priorityFilter.addEventListener("change", applyStatusFilter);
}

if (statusTabs?.length) {
  statusTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.status || "All";
      activeStatusTab = next;
      statusTabs.forEach((b) => b.classList.toggle("active", b === btn));
      statusTabs.forEach((b) => b.setAttribute("aria-selected", b === btn ? "true" : "false"));
      applyStatusFilter();
    });
  });
}

if (subjectInput) subjectInput.addEventListener("input", () => {
  // Extra frontend-only knowledge suggestions are disabled until backend has a knowledge-base API.
  saveDraft();
});
// Extra frontend-only knowledge-base feedback is disabled until backend has KB routes.
// kbList?.addEventListener("click", handleKbFeedbackVote);
// kbPageList?.addEventListener("click", handleKbFeedbackVote);
if (attachmentInput) attachmentInput.addEventListener("change", validateAttachment);
if (attachmentDropzone && attachmentInput) {
  const trigger = () => attachmentInput.click();
  attachmentDropzone.addEventListener("click", trigger);
  attachmentDropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      trigger();
    }
  });
}

if (editorToolButtons?.length) {
  editorToolButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = String(btn.dataset.format || "");
      if (action) applyEditorAction(action);
    });
  });
}
if (emojiPicker) {
  renderEmojiPicker();
  emojiPicker.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const emoji = target.dataset.emoji;
    if (!emoji) return;
    replaceSelection(desc, (selected) => ({ text: `${selected}${emoji}` }));
    closeEmojiPicker();
  });
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const inPicker = emojiPicker.contains(target);
    const onEmojiBtn = Boolean(target.closest('.tool-btn[data-format="emoji"]'));
    if (!inPicker && !onEmojiBtn) closeEmojiPicker();
  });
}

["category", "department", "name", "email", "location"].forEach((fieldName) => {
  if (!form[fieldName]) return;
  form[fieldName].addEventListener("input", saveDraft);
});
if (form?.name) {
  form.name.addEventListener("input", syncMessageFromName);
}
if (form.consent) form.consent.addEventListener("change", saveDraft);
if (trackForm.trackEmail) {
  trackForm.trackEmail.addEventListener("keydown", (event) => {
    if (event.key === "Enter") return;
  });
}

sidebarDashboardBtn?.addEventListener("click", () => {
  setActiveSidebarItem("dashboard");
  openTrackPanel();
});

// Extra frontend-only Knowledge Base page is disabled until backend has KB routes.
// sidebarKnowledgeBtn?.addEventListener("click", () => {
//   setActiveSidebarItem("knowledge");
//   openKnowledgeBasePanel();
// });

// Extra frontend-only KB feedback reset is disabled until backend has KB routes.
// btnResetKbFeedback?.addEventListener("click", () => {
//   try {
//     localStorage.removeItem(kbFeedbackStorageKey);
//   } catch {
//     // no-op for storage errors
//   }
//   updateKnowledgeSuggestions();
//   renderKnowledgeBasePage();
// });

form.addEventListener("reset", () => {
  setTimeout(() => {
    setTextContent(descCount, "0");
    if (kbList) kbList.innerHTML = "";
    kbSuggestions?.querySelector(".kb-empty")?.style.setProperty("display", "block");
    setTextContent(attachmentInfo, "");
    if (attachmentPreview) attachmentPreview.classList.add("hidden");
    clearDraft();
    setTextContent(slaHint, "Priority will be assigned by admin triage after review.");
  }, 0);
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tabName = button.dataset.tab;
    tabButtons.forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    Object.entries(panels).forEach(([name, panel]) => {
      panel.classList.toggle("active", name === tabName);
    });
  });
});

loadDraft();
// Extra frontend-only KB rendering is disabled until backend has KB routes.
// updateKnowledgeSuggestions();
// renderKnowledgeBasePage();
setActiveSidebarItem("dashboard");

// -----------------------------
// Modal / Profile wiring
// -----------------------------

/* Extra frontend-only function disabled: profile preferences have no backend route yet.
btnProfile?.addEventListener("click", openProfileModal);
*/

btnLogout?.addEventListener("click", () => {
  localStorage.removeItem(sessionKey);
  updateHeaderAuthUi();
  closeModal(profileModal);
});

sidebarLogoutBtn?.addEventListener("click", () => {
  localStorage.removeItem(sessionKey);
  updateHeaderAuthUi();
  closeModal(profileModal);
  window.location.href = "./login.html";
});

function openCreateModal() {
  if (!createFormWrap || !form) return;

  const session = loadSession();
  if (!session?.email) {
    window.location.href = "./login.html";
    return;
  }

  // Ensure modal can render even if submitPanel is hidden.
  if (panels?.submit && panels?.track) {
    panels.submit.classList.add("active");
    panels.track.classList.remove("active");
  }

  // Prefill requester identity from the signed-in session.
  if (form.name) form.name.value = session.name || form.name.value || "Portal User";
  if (form.email) form.email.value = session.email;
  syncMessageFromName();

  if (form.consent) form.consent.checked = true;

  if (form.category && !form.category.value) form.category.value = "IT";
  if (form.department && !form.department.value) form.department.value = form.category?.value || "IT";

  createFormWrap.classList.remove("hidden");
  createFormWrap.setAttribute("aria-hidden", "false");
  form?.subject?.focus?.();
}

btnNewTicket?.addEventListener("click", openCreateModal);
btnNewTicketTop?.addEventListener("click", openCreateModal);

function closeCreateFormWrap(options = {}) {
  if (!createFormWrap) return;
  createFormWrap.classList.add("hidden");
  createFormWrap.setAttribute("aria-hidden", "true");
  if (!options.keepResult) hideSubmitResult();
  if (panels?.submit && panels?.track) {
    panels.submit.classList.remove("active");
    panels.track.classList.add("active");
  }
}

btnCloseCreate?.addEventListener("click", closeCreateFormWrap);
btnCancelCreate?.addEventListener("click", closeCreateFormWrap);

/* Extra frontend-only function disabled: profile preferences have no backend route yet.
profileForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const session = loadSession();
  if (!session) return;
  session.prefs = {
    notifEmail: Boolean(notifEmail?.checked),
    notifInApp: Boolean(notifInApp?.checked),
  };
  saveSession(session);
  closeModal(profileModal);
});
*/

// Close modals on backdrop click.
document.addEventListener("click", (e) => {
  const target = e.target;
  if (!target) return;
  /* Extra frontend-only function disabled: profile modal has no backend route yet.
  if (target.dataset?.closeProfile === "true") closeModal(profileModal);
  */
});

// Close modals on ESC.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  /* Extra frontend-only function disabled: profile modal has no backend route yet.
  closeModal(profileModal);
  */
  if (createFormWrap) closeCreateFormWrap();
  closeNotifDropdown();
  closeEmojiPicker();
});

// SLA countdown auto-refresh for visible ticket rows.
function updateVisibleSlaCountdown() {
  const rows = document.querySelectorAll(".ticket-row");
  rows.forEach((row) => {
    const ticketId = row.dataset.ticketId;
    const ticket = lastLoadedTickets.find((t) => (t.ticket_id || "") === ticketId);
    if (!ticket) return;
    const slaLabel = computeSlaDueLabel(ticket);
    const cell = row.querySelector(".ticket-sla");
    if (cell) cell.textContent = slaLabel;
  });
}

if (lastLoadedTickets?.length) updateVisibleSlaCountdown();
setInterval(updateVisibleSlaCountdown, 60 * 1000);

updateHeaderAuthUi();

const bootSession = loadSession();
if (!bootSession?.email) {
  window.location.replace("./login.html");
} else if (bootSession?.role && String(bootSession.role).toLowerCase() === "admin") {
  window.location.replace("./admin.html");
}
if (bootSession?.email) {
  (async () => {
    try {
      const data = await getTicketsByEmail(bootSession.email);
      lastLoadedTickets = Array.isArray(data?.tickets) ? data.tickets.map(normalizeTicketRecord) : [];
      persistTicketCache(lastLoadedTickets);
      applyStatusFilter();
    } catch {
      lastLoadedTickets = [];
      applyStatusFilter();
    }
  })();
}
