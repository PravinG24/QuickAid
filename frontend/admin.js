const sessionKey = "quickaid-session-v1";
const DEFAULT_API_BASE = "http://localhost:7071";
const API_BASE = Object.prototype.hasOwnProperty.call(window, "QUICKAID_API_BASE")
  ? window.QUICKAID_API_BASE
  : DEFAULT_API_BASE;
const API_BASE_CONFIGURED = true;
const accountsStorageKey = "quickaid-accounts-v1";
const accessRequestsStorageKey = "quickaid-access-requests-v1";
const SYSTEM_ADMIN_EMAIL = "admin@campus.edu";

function loadSession() {
  const raw = localStorage.getItem(sessionKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadLocalAccessRequests() {
  try {
    const raw = localStorage.getItem(accessRequestsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalAccessRequests(items) {
  localStorage.setItem(accessRequestsStorageKey, JSON.stringify(Array.isArray(items) ? items : []));
}

function loadLocalAccounts() {
  try {
    const raw = localStorage.getItem(accountsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalAccounts(items) {
  localStorage.setItem(accountsStorageKey, JSON.stringify(Array.isArray(items) ? items : []));
}

function isAdminSession(session) {
  return String(session?.role || "").toLowerCase() === "admin";
}

function isSystemAdminSession(session) {
  return isAdminSession(session) && String(session?.email || "").toLowerCase() === SYSTEM_ADMIN_EMAIL;
}

const session = loadSession();
if (!isAdminSession(session)) {
  window.location.replace("./dashboard.html");
}

// ─── Sidebar toggle ───
const adminSidebar = document.querySelector(".admin-sidebar");
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
const mobileSidebarToggleBtn = document.getElementById("mobileSidebarToggleBtn");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const mobileMediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 1080px)") : null;

function isMobileViewport() {
  if (mobileMediaQuery) return mobileMediaQuery.matches;
  return window.innerWidth <= 1080;
}

function setSidebarState(isCollapsed, shouldPersist = true) {
  adminSidebar?.classList.toggle("collapsed", isCollapsed);
  const expanded = String(!isCollapsed);
  sidebarToggleBtn?.setAttribute("aria-expanded", expanded);
  mobileSidebarToggleBtn?.setAttribute("aria-expanded", expanded);

  const isMobile = isMobileViewport();
  if (sidebarOverlay) {
    const showOverlay = isMobile && !isCollapsed;
    sidebarOverlay.hidden = !showOverlay;
    sidebarOverlay.classList.toggle("active", showOverlay);
  }
  document.body.classList.toggle("sidebar-mobile-open", isMobile && !isCollapsed);

  if (shouldPersist) {
    localStorage.setItem("adminSidebarCollapsed", String(isCollapsed));
  }
}

(function initSidebarState() {
  const saved = localStorage.getItem("adminSidebarCollapsed");
  const shouldOpen = saved === "false" && !isMobileViewport();
  setSidebarState(!shouldOpen, false);
})();

function toggleSidebar() {
  const isNowCollapsed = !adminSidebar || !adminSidebar.classList.contains("collapsed") ? true : false;
  setSidebarState(isNowCollapsed);
}

sidebarToggleBtn?.addEventListener("click", toggleSidebar);
mobileSidebarToggleBtn?.addEventListener("click", toggleSidebar);
sidebarOverlay?.addEventListener("click", () => setSidebarState(true, false));

const handleViewportChange = () => {
  const isCollapsed = adminSidebar?.classList.contains("collapsed") ?? true;
  setSidebarState(isCollapsed, false);
};

if (mobileMediaQuery) {
  if (typeof mobileMediaQuery.addEventListener === "function") {
    mobileMediaQuery.addEventListener("change", handleViewportChange);
  } else if (typeof mobileMediaQuery.addListener === "function") {
    mobileMediaQuery.addListener(handleViewportChange);
  }
} else {
  window.addEventListener("resize", handleViewportChange);
}

const adminSessionLabel = document.getElementById("adminSessionLabel");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminBtnSignIn = document.getElementById("adminBtnSignIn");
const adminBtnLogout = document.getElementById("adminBtnLogout");
const adminBtnNotifications = document.getElementById("adminBtnNotifications");
const adminNotifDropdown = document.getElementById("adminNotifDropdown");
const adminNotifBadge = document.getElementById("adminNotifBadge");
const adminNotifUnreadCount = document.getElementById("adminNotifUnreadCount");
const adminNotifList = document.getElementById("adminNotifList");
const adminBtnMarkAllRead = document.getElementById("adminBtnMarkAllRead");

const adminNotifications = [
  { id: "n1", title: "3 high-priority tickets need triage", time: "5m ago", read: false },
  { id: "n2", title: "IT Network Services resolved TKT-309", time: "18m ago", read: false },
  { id: "n3", title: "Weekly admin report is ready", time: "1h ago", read: true },
];

function logoutAndRedirectToLogin() {
  localStorage.removeItem(sessionKey);
  window.location.href = "./login.html";
}

function updateAdminAuthUi() {
  if (adminSessionLabel && session?.email) {
    adminSessionLabel.textContent = `Signed in as ${session.email}`;
  }
  if (session?.email) {
    adminBtnSignIn?.classList.add("hidden");
    adminBtnLogout?.classList.remove("hidden");
  } else {
    adminBtnSignIn?.classList.remove("hidden");
    adminBtnLogout?.classList.add("hidden");
  }
}

function renderAdminNotifications() {
  if (!adminNotifList) return;
  adminNotifList.innerHTML = adminNotifications
    .map(
      (item) => `
      <li class="notif-item ${item.read ? "notif-item-read" : "notif-item-unread"}" data-notif-id="${item.id}">
        <span class="${item.read ? "notif-check" : "notif-dot"}" aria-hidden="true">${item.read ? "✓" : ""}</span>
        <div class="notif-text">
          <p class="notif-text-title">${item.title}</p>
          <p class="notif-time">${item.time}</p>
        </div>
      </li>
    `
    )
    .join("");
}

function updateAdminNotificationUi() {
  const unread = adminNotifications.filter((item) => !item.read).length;
  if (adminNotifUnreadCount) adminNotifUnreadCount.textContent = String(unread);
  if (adminNotifBadge) {
    adminNotifBadge.textContent = String(unread);
    adminNotifBadge.classList.toggle("hidden", unread <= 0);
  }
  renderAdminNotifications();
}

function closeAdminNotifDropdown() {
  adminNotifDropdown?.classList.add("hidden");
  adminBtnNotifications?.setAttribute("aria-expanded", "false");
}

function toggleAdminNotifDropdown() {
  if (!adminNotifDropdown || !adminBtnNotifications) return;
  const willOpen = adminNotifDropdown.classList.contains("hidden");
  adminNotifDropdown.classList.toggle("hidden", !willOpen);
  adminBtnNotifications.setAttribute("aria-expanded", willOpen ? "true" : "false");
}

updateAdminAuthUi();
updateAdminNotificationUi();

adminLogoutBtn?.addEventListener("click", logoutAndRedirectToLogin);
adminBtnLogout?.addEventListener("click", logoutAndRedirectToLogin);
adminBtnNotifications?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAdminNotifDropdown();
});
adminBtnMarkAllRead?.addEventListener("click", () => {
  adminNotifications.forEach((item) => {
    item.read = true;
  });
  updateAdminNotificationUi();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const insideNotif = Boolean(target.closest(".notif-wrap"));
  if (!insideNotif) closeAdminNotifDropdown();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAdminNotifDropdown();
});

const pageLinks = Array.from(document.querySelectorAll("[data-page-link]"));
const pages = Array.from(document.querySelectorAll(".admin-page"));
const rangeButtons = Array.from(document.querySelectorAll(".range-tab[data-range]"));
const adminTicketModal = document.getElementById("adminTicketModal");
const adminTicketModalContent = document.getElementById("adminTicketModalContent");
const openBulkEditBtn = document.getElementById("openBulkEditBtn");
const manageSelectionCount = document.getElementById("manageSelectionCount");
const bulkEditDrawer = document.getElementById("bulkEditDrawer");
const bulkDrawerSelectionCount = document.getElementById("bulkDrawerSelectionCount");
const bulkDrawerTicketPreview = document.getElementById("bulkDrawerTicketPreview");
const bulkDrawerStatusSelect = document.getElementById("bulkDrawerStatusSelect");
const bulkDrawerTeamSelect = document.getElementById("bulkDrawerTeamSelect");
const bulkDrawerSummary = document.getElementById("bulkDrawerSummary");
const bulkDrawerApplyBtn = document.getElementById("bulkDrawerApplyBtn");
const bulkDrawerClearSelection = document.getElementById("bulkDrawerClearSelection");
const addStaffModal = document.getElementById("addStaffModal");
const addStaffForm = document.getElementById("addStaffForm");
const addStaffFormError = document.getElementById("addStaffFormError");
const addStaffTeamHint = document.getElementById("addStaffTeamHint");
const addStaffNameInput = document.getElementById("addStaffName");
const addStaffRoleInput = document.getElementById("addStaffRole");
const addStaffEmailInput = document.getElementById("addStaffEmail");
const addStaffPhoneInput = document.getElementById("addStaffPhone");
const addStaffSubmitBtn = document.getElementById("addStaffSubmitBtn");
const sharedTicketView = window.QuickAidTicketView || {};
const overviewStatusOptions = ["Open", "In Progress", "Resolved", "Closed"];
const overviewPriorityOptions = ["High", "Medium", "Low"];
const overviewTeamOptions = [
  "IT Network Services",
  "Digital Learning Support",
  "Accounts and Access",
  "Device Support",
  "Campus Facilities",
  "Academic Systems",
  "Facilities",
];

const nowForAdminMock = new Date();
function isoFromOffset({ days = 0, months = 0, years = 0, hours = 10, minutes = 0 }) {
  const date = new Date(nowForAdminMock);
  date.setFullYear(date.getFullYear() - years);
  date.setMonth(date.getMonth() - months);
  date.setDate(date.getDate() - days);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

const mockAdminData = {
  overview: {
    metrics: { totalTickets: 5, open: 2, inProgress: 2, resolved: 1 },
    categoryDistribution: [
      { label: "Network Access", value: 1 },
      { label: "Learning Systems", value: 1 },
      { label: "Account Access", value: 1 },
      { label: "Device Support", value: 1 },
      { label: "Email and Collaboration", value: 1 },
    ],
    priorityDistribution: [
      { label: "High", percent: 40, className: "high" },
      { label: "Medium", percent: 40, className: "medium" },
      { label: "Low", percent: 20, className: "low" },
    ],
    weeklyTrend: {
      created: [12, 15, 10, 18, 14, 6, 4],
      resolved: [8, 10, 12, 14, 16, 8, 5],
    },
    tickets: [
      {
        ticketId: "TKT-301",
        user: "Aiman Zulkifli",
        issue: "Campus VPN disconnects every five minutes",
        category: "Network Access",
        priority: "High",
        status: "In Progress",
        assignedTeam: "IT Network Services",
        created_at: isoFromOffset({ days: 0, hours: 9, minutes: 30 }),
        submitted_at: isoFromOffset({ days: 0, hours: 9, minutes: 30 }),
        updated_at: isoFromOffset({ days: 0, hours: 12, minutes: 15 }),
      },
      {
        ticketId: "TKT-302",
        user: "Mei Ling Tan",
        issue: "Need Microsoft 365 on new faculty laptop",
        category: "Learning Systems",
        priority: "Medium",
        status: "Open",
        assignedTeam: "Digital Learning Support",
        created_at: isoFromOffset({ days: 0, hours: 8, minutes: 45 }),
        submitted_at: isoFromOffset({ days: 0, hours: 8, minutes: 45 }),
        updated_at: isoFromOffset({ days: 0, hours: 10, minutes: 5 }),
      },
      {
        ticketId: "TKT-303",
        user: "Harith Osman",
        issue: "Cannot access shared drive after password reset",
        category: "Account Access",
        priority: "High",
        status: "Resolved",
        assignedTeam: "Accounts and Access",
        created_at: isoFromOffset({ days: 2, hours: 11, minutes: 0 }),
        submitted_at: isoFromOffset({ days: 2, hours: 11, minutes: 0 }),
        updated_at: isoFromOffset({ days: 1, hours: 14, minutes: 25 }),
      },
      {
        ticketId: "TKT-304",
        user: "Sofia Rahman",
        issue: "Keyboard keys not responding properly",
        category: "Device Support",
        priority: "Low",
        status: "Open",
        assignedTeam: "Device Support",
        created_at: isoFromOffset({ days: 5, hours: 9, minutes: 40 }),
        submitted_at: isoFromOffset({ days: 5, hours: 9, minutes: 40 }),
        updated_at: isoFromOffset({ days: 4, hours: 16, minutes: 10 }),
      },
      {
        ticketId: "TKT-305",
        user: "Nadia Ismail",
        issue: "Email not syncing on mobile device",
        category: "Email and Collaboration",
        priority: "Medium",
        status: "In Progress",
        assignedTeam: "Accounts and Access",
        created_at: isoFromOffset({ days: 12, hours: 10, minutes: 20 }),
        submitted_at: isoFromOffset({ days: 12, hours: 10, minutes: 20 }),
        updated_at: isoFromOffset({ days: 10, hours: 13, minutes: 0 }),
      },
      {
        ticketId: "TKT-306",
        user: "Aisha Tan",
        issue: "Attendance module page crashes on submit",
        category: "Academic Systems",
        priority: "High",
        status: "Open",
        assignedTeam: "Academic Systems",
        created_at: isoFromOffset({ days: 20, hours: 15, minutes: 5 }),
        submitted_at: isoFromOffset({ days: 20, hours: 15, minutes: 5 }),
        updated_at: isoFromOffset({ days: 19, hours: 9, minutes: 30 }),
      },
      {
        ticketId: "TKT-307",
        user: "Ben Lee",
        issue: "Lab printer toner replacement request",
        category: "Campus Facilities",
        priority: "Low",
        status: "Resolved",
        assignedTeam: "Campus Facilities",
        created_at: isoFromOffset({ months: 2, days: 3, hours: 10, minutes: 0 }),
        submitted_at: isoFromOffset({ months: 2, days: 3, hours: 10, minutes: 0 }),
        updated_at: isoFromOffset({ months: 2, days: 1, hours: 11, minutes: 10 }),
      },
      {
        ticketId: "TKT-308",
        user: "Farah Lim",
        issue: "Legacy account access request",
        category: "Account Access",
        priority: "Medium",
        status: "Resolved",
        assignedTeam: "Accounts and Access",
        created_at: isoFromOffset({ years: 1, months: 1, days: 2, hours: 9, minutes: 0 }),
        submitted_at: isoFromOffset({ years: 1, months: 1, days: 2, hours: 9, minutes: 0 }),
        updated_at: isoFromOffset({ years: 1, months: 1, days: 1, hours: 12, minutes: 0 }),
      },
      {
        ticketId: "TKT-309",
        user: "Nurul Hadi",
        issue: "Student Wi-Fi onboarding fails for new users",
        category: "Network Access",
        priority: "Medium",
        status: "In Progress",
        assignedTeam: "IT Network Services",
        created_at: isoFromOffset({ days: 6, hours: 14, minutes: 10 }),
        submitted_at: isoFromOffset({ days: 6, hours: 14, minutes: 10 }),
        updated_at: isoFromOffset({ days: 5, hours: 11, minutes: 55 }),
      },
      {
        ticketId: "TKT-310",
        user: "Hui Wen",
        issue: "Blocked from staff portal after MFA reset",
        category: "Account Access",
        priority: "High",
        status: "Open",
        assignedTeam: "Accounts and Access",
        created_at: isoFromOffset({ days: 3, hours: 10, minutes: 40 }),
        submitted_at: isoFromOffset({ days: 3, hours: 10, minutes: 40 }),
        updated_at: isoFromOffset({ days: 2, hours: 9, minutes: 5 }),
      },
      {
        ticketId: "TKT-311",
        user: "Daniel Chong",
        issue: "Projector remote battery replacement request",
        category: "Facilities",
        priority: "Low",
        status: "Resolved",
        assignedTeam: "Campus Facilities",
        created_at: isoFromOffset({ months: 1, days: 1, hours: 9, minutes: 15 }),
        submitted_at: isoFromOffset({ months: 1, days: 1, hours: 9, minutes: 15 }),
        updated_at: isoFromOffset({ months: 1, hours: 12, minutes: 0 }),
      },
    ],
  },
  manageTickets: {
    tickets: [],
  },
  analytics: {
    summary: {
      new: 15,
      complete: 87,
      staff: 10,
      users: 12,
      tickets: 1266,
    },
    cards: [
      { title: "Ticket Trends", copy: "Open volume rose 14% this week, with peak load on Wednesday." },
      { title: "SLA Performance", copy: "94% of tickets met SLA, and high-priority breaches dropped to 6%." },
      { title: "Resolution Quality", copy: "Requester satisfaction remains steady at 4.7/5 with faster follow-ups." },
    ],
  },
  supportTeams: {
    teams: [
      {
        id: "technical",
        name: "IT Services",
        badge: "T",
        badgeClass: "blue",
        members: 4,
        activeTickets: 45,
        lead: "Aina Farid",
        leadRole: "Service Desk Lead",
        email: "aina.farid@campus.edu",
        phone: "+60 3-8899 4211",
        permissions: 4,
        stats: { active: 8, resolved: 142, avgTime: "2.3h", satisfaction: "98%" },
        staffMembers: [
          { name: "Aina Farid", role: "Service Desk Lead", email: "aina.farid@campus.edu", phone: "+60 3-8899 4211", activeTickets: 8 },
          { name: "Noah King", role: "Support Officer", email: "noah.king@campus.edu", phone: "+60 3-8899 4212", activeTickets: 6 },
          { name: "Amira Low", role: "Support Officer", email: "amira.low@campus.edu", phone: "+60 3-8899 4213", activeTickets: 5 },
          { name: "Hakim Musa", role: "Support Officer", email: "hakim.musa@campus.edu", phone: "+60 3-8899 4214", activeTickets: 4 },
        ],
      },
      {
        id: "billing",
        name: "Finance Office",
        badge: "B",
        badgeClass: "green",
        members: 2,
        activeTickets: 23,
        lead: "Nurul Izzah",
        leadRole: "Finance Support Lead",
        email: "nurul.izzah@campus.edu",
        phone: "+60 3-8899 4311",
        permissions: 3,
        stats: { active: 5, resolved: 93, avgTime: "2.8h", satisfaction: "96%" },
        staffMembers: [
          { name: "Nurul Izzah", role: "Finance Support Lead", email: "nurul.izzah@campus.edu", phone: "+60 3-8899 4311", activeTickets: 5 },
          { name: "Jia Yi", role: "Finance Support Officer", email: "jia.yi@campus.edu", phone: "+60 3-8899 4312", activeTickets: 3 },
        ],
      },
      {
        id: "premium",
        name: "Academic Affairs",
        badge: "P",
        badgeClass: "purple",
        members: 2,
        activeTickets: 18,
        lead: "Lisa Anderson",
        leadRole: "Academic Systems Lead",
        email: "lisa.anderson@campus.edu",
        phone: "+60 3-8899 4411",
        permissions: 4,
        stats: { active: 4, resolved: 81, avgTime: "1.9h", satisfaction: "99%" },
        staffMembers: [
          { name: "Lisa Anderson", role: "Academic Systems Lead", email: "lisa.anderson@campus.edu", phone: "+60 3-8899 4411", activeTickets: 4 },
          { name: "Sean Koh", role: "Academic Support Officer", email: "sean.koh@campus.edu", phone: "+60 3-8899 4412", activeTickets: 3 },
        ],
      },
      {
        id: "sales",
        name: "Student Affairs",
        badge: "S",
        badgeClass: "orange",
        members: 1,
        activeTickets: 12,
        lead: "Robert Taylor",
        leadRole: "Student Affairs Coordinator",
        email: "robert.taylor@campus.edu",
        phone: "+60 3-8899 4511",
        permissions: 2,
        stats: { active: 2, resolved: 44, avgTime: "3.1h", satisfaction: "95%" },
        staffMembers: [
          { name: "Robert Taylor", role: "Student Affairs Coordinator", email: "robert.taylor@campus.edu", phone: "+60 3-8899 4511", activeTickets: 2 },
        ],
      },
    ],
    // TEMP_DATA_PERMISSION_QA:
    // This seed set intentionally mixes pending/approved/rejected and staff/admin requests.
    // QA flow:
    // 1) Approve pending request -> requester should appear in group details staff cards.
    // 2) Team members count should increment and match staffMembers.length.
    // 3) Reject request -> account approvalStatus should become "rejected", no team insertion.
    accessRequests: [
      { id: "AR-001", teamId: "technical", requester: "Emily Chen", email: "emily.chen@campus.edu", department: "IT Services", role: "Staff", status: "pending", date: "Feb 3, 2026, 9:15 AM" },
      { id: "AR-002", teamId: "billing", requester: "Michael Brown", email: "michael.brown@campus.edu", department: "Finance Office", role: "Staff", status: "pending", date: "Feb 2, 2026, 2:30 PM" },
      { id: "AR-003", teamId: "admin-department", requester: "Lisa Anderson", email: "lisa.anderson@campus.edu", department: "Administration Office", role: "Admin", status: "pending", date: "Feb 1, 2026, 11:20 AM" },
      { id: "AR-004", teamId: "sales", requester: "Robert Taylor", email: "robert.taylor@campus.edu", department: "Student Affairs", role: "Staff", status: "pending", date: "Jan 31, 2026, 10:00 AM" },
      { id: "AR-005", teamId: "admin-department", requester: "Hafiz Rahman", email: "hafiz.rahman@campus.edu", department: "Administration Office", role: "Admin", status: "pending", date: "Jan 30, 2026, 8:45 AM" },
      { id: "AR-006", teamId: "billing", requester: "Nurul Izzah", email: "nurul.izzah@campus.edu", department: "Finance Office", role: "Staff", status: "approved", date: "Jan 29, 2026, 4:10 PM", reviewedBy: "Admin" },
      { id: "AR-007", teamId: "premium", requester: "Jason Lim", email: "jason.lim@campus.edu", department: "Academic Affairs", role: "Staff", status: "rejected", date: "Jan 28, 2026, 1:45 PM", reviewedBy: "Admin" },
      { id: "AR-008", teamId: "admin-department", requester: "Aina Yusuf", email: "aina.yusuf@campus.edu", department: "Administration Office", role: "Admin", status: "approved", date: "Jan 27, 2026, 11:05 AM", reviewedBy: "Admin" },
    ],
  },
};

// Keep manage list aligned with overview mock tickets for range testing.
if (!Array.isArray(mockAdminData.manageTickets.tickets) || !mockAdminData.manageTickets.tickets.length) {
  mockAdminData.manageTickets.tickets = mockAdminData.overview.tickets.map((ticket) => ({ ...ticket }));
}

let activeRange = "today";
let allTicketsState = [];
let overviewTicketsState = [];
let updateToastTimer = null;
let overviewTrendChart = null;
let activeOverviewModalTicketId = "";
const selectedManageTicketIds = new Set();
let activeSupportTeamId = "";
let supportRequestFilterValue = "all";
let supportTeamsState = null;
let activeSupportTab = "groups";
let lastAdminApiError = "";
const addTeamModal = document.getElementById("addTeamModal");
const addTeamForm = document.getElementById("addTeamForm");
const addTeamNameInput = document.getElementById("addTeamName");
const addTeamLeadInput = document.getElementById("addTeamLead");
const addTeamLeadEmailInput = document.getElementById("addTeamLeadEmail");
const addTeamNameError = document.getElementById("addTeamNameError");
const addTeamLeadError = document.getElementById("addTeamLeadError");
const addTeamLeadEmailError = document.getElementById("addTeamLeadEmailError");

function resolveApiUrl(path) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

function getEntraScope() {
  return (
    String(window.QUICKAID_ENTRA_API_SCOPE || "").trim() ||
    `${String(window.QUICKAID_ENTRA_API_AUDIENCE || "").trim()}/access_as_user`
  );
}

let adminMsalInstancePromise = null;

async function getAdminMsalInstance() {
  if (adminMsalInstancePromise) return adminMsalInstancePromise;

  adminMsalInstancePromise = (async () => {
    if (!window.msal?.PublicClientApplication) return null;
    const clientId = String(window.QUICKAID_ENTRA_CLIENT_ID || "").trim();
    const tenantId = String(window.QUICKAID_ENTRA_TENANT_ID || "").trim();
    if (!clientId || !tenantId) return null;

    const msalInstance = new window.msal.PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: String(window.QUICKAID_ENTRA_REDIRECT_URI || `${window.location.origin}/login.html`).trim(),
      },
      cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
    });

    if (typeof msalInstance.initialize === "function") {
      await msalInstance.initialize();
    }

    return msalInstance;
  })();

  return adminMsalInstancePromise;
}

async function ensureAdminAccessToken() {
  const existingToken = String(session?.token || "").trim();
  if (existingToken) return existingToken;

  if (String(session?.provider || "").toLowerCase() !== "entra") return "";

  try {
    const msalInstance = await getAdminMsalInstance();
    if (!msalInstance) return "";

    const account = msalInstance.getAllAccounts()[0];
    const scope = getEntraScope();
    if (!account || !scope || scope.startsWith("/")) return "";

    const tokenResult = await msalInstance.acquireTokenSilent({ account, scopes: [scope] });
    const accessToken = String(tokenResult?.accessToken || "").trim();
    if (!accessToken) return "";

    if (session) {
      session.token = accessToken;
      localStorage.setItem(sessionKey, JSON.stringify(session));
    }

    return accessToken;
  } catch (error) {
    console.warn("QuickAid: unable to silently refresh Entra access token.", error);
    return "";
  }
}

function apiHeaders(extra = {}, tokenOverride = "") {
  const headers = { ...extra };
  const functionKey = String(window.QUICKAID_FUNCTION_KEY || "").trim();
  if (functionKey) headers["x-functions-key"] = functionKey;

  const sessionToken = String(tokenOverride || session?.token || "").trim();
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

  return headers;
}

async function fetchJsonOrFallback(path, fallbackData) {
  const url = resolveApiUrl(path);
  try {
    const accessToken = await ensureAdminAccessToken();
    const response = await fetch(url, { headers: apiHeaders({ Accept: "application/json" }, accessToken) });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const compactBody = String(errorBody || "").replace(/\s+/g, " ").trim();
      throw new Error(compactBody ? `Request failed (${response.status}): ${compactBody}` : `Request failed (${response.status}).`);
    }
    lastAdminApiError = "";
    return await response.json();
  } catch (error) {
    const message = String(error?.message || "Request failed.").trim();
    lastAdminApiError = message;
    console.error("QuickAid admin API error:", message);
    return fallbackData;
  }
}

function toPriorityClass(priority) {
  const value = String(priority || "").toLowerCase();
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  return "low";
}

function escapeHtml(value) {
  if (sharedTicketView.escapeHtml) return sharedTicketView.escapeHtml(value);
  return String(value || "");
}

function closeAdminModal() {
  if (!adminTicketModal) return;
  adminTicketModal.classList.add("hidden");
}

function openAdminModal() {
  if (!adminTicketModal) return;
  adminTicketModal.classList.remove("hidden");
}

function closeBulkEditDrawer() {
  bulkEditDrawer?.classList.add("hidden");
}

function openBulkEditDrawer() {
  bulkEditDrawer?.classList.remove("hidden");
}

function getSelectedManageTickets() {
  return allTicketsState.filter((ticket) => selectedManageTicketIds.has(String(ticket.ticketId)));
}

function updateBulkDrawerSummary() {
  if (!bulkDrawerSummary) return;
  const selectedCount = getSelectedManageTickets().length;
  const nextStatus = bulkDrawerStatusSelect instanceof HTMLSelectElement ? String(bulkDrawerStatusSelect.value || "").trim() : "";
  const nextTeam = bulkDrawerTeamSelect instanceof HTMLSelectElement ? String(bulkDrawerTeamSelect.value || "").trim() : "";
  if (!selectedCount) {
    bulkDrawerSummary.textContent = "No tickets selected. Select tickets from the table first.";
    return;
  }
  if (!nextStatus && !nextTeam) {
    bulkDrawerSummary.textContent = "Choose status, team, or both.";
    return;
  }
  if (nextStatus && nextTeam) {
    bulkDrawerSummary.textContent = `Will set status to ${nextStatus} and assign ${nextTeam} for ${selectedCount} ticket(s).`;
    return;
  }
  if (nextStatus) {
    bulkDrawerSummary.textContent = `Will update status to ${nextStatus} for ${selectedCount} ticket(s).`;
    return;
  }
  bulkDrawerSummary.textContent = `Will assign ${nextTeam} for ${selectedCount} ticket(s).`;
}

function updateBulkApplyState() {
  if (!(bulkDrawerApplyBtn instanceof HTMLButtonElement)) return;
  const selectedCount = getSelectedManageTickets().length;
  const nextStatus =
    bulkDrawerStatusSelect instanceof HTMLSelectElement
      ? String(bulkDrawerStatusSelect.value || "").trim()
      : "";
  const nextTeam =
    bulkDrawerTeamSelect instanceof HTMLSelectElement
      ? String(bulkDrawerTeamSelect.value || "").trim()
      : "";
  const hasChanges = Boolean(nextStatus || nextTeam);
  const canApply = selectedCount > 0 && hasChanges;
  bulkDrawerApplyBtn.disabled = !canApply;
  bulkDrawerApplyBtn.textContent = canApply ? "Apply Changes" : "Select Changes";
}

function updateBulkSelectionUi() {
  const selectedCount = getSelectedManageTickets().length;
  if (manageSelectionCount) {
    manageSelectionCount.textContent =
      selectedCount > 0 ? `${selectedCount} ticket(s) selected` : "No tickets selected";
  }
  if (openBulkEditBtn instanceof HTMLButtonElement) {
    openBulkEditBtn.disabled = selectedCount === 0;
    openBulkEditBtn.textContent =
      selectedCount > 0 ? `Bulk Edit Selected (${selectedCount})` : "Bulk Edit Selected";
  }
  if (bulkDrawerSelectionCount) {
    bulkDrawerSelectionCount.textContent = `${selectedCount} ticket(s) selected`;
  }
  if (bulkDrawerTicketPreview) {
    const selected = getSelectedManageTickets();
    if (!selected.length) {
      bulkDrawerTicketPreview.textContent = "No tickets selected yet.";
    } else {
      const previewIds = selected.map((ticket) => ticket.ticketId).join(", ");
      bulkDrawerTicketPreview.textContent = `Selected: ${previewIds}`;
    }
  }
  updateBulkDrawerSummary();
  updateBulkApplyState();
}

function showUpdateToast({ title, detail, tone = "success" }) {
  let toast = document.getElementById("adminUpdateToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "adminUpdateToast";
    toast.className = "admin-update-toast hidden";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");
    toast.tabIndex = 0;
    toast.innerHTML = `
      <div class="admin-update-toast-icon" aria-hidden="true"></div>
      <div class="admin-update-toast-body">
      <div class="admin-update-toast-title"></div>
      <div class="admin-update-toast-detail"></div>
      </div>
    `;
    toast.addEventListener("click", () => {
      toast.classList.remove("show");
      toast.classList.add("hidden");
    });
    document.body.appendChild(toast);
  }
  const titleEl = toast.querySelector(".admin-update-toast-title");
  const detailEl = toast.querySelector(".admin-update-toast-detail");
  if (titleEl) titleEl.textContent = title || "Updated";
  if (detailEl) {
    detailEl.textContent = detail || "";
    detailEl.classList.toggle("is-empty", !detail);
  }
  toast.dataset.tone = tone;
  toast.classList.remove("hidden");
  toast.classList.add("show");
  if (updateToastTimer) window.clearTimeout(updateToastTimer);
  const dismissMs = detail ? 2200 : 1700;
  updateToastTimer = window.setTimeout(() => {
    toast?.classList.remove("show");
    toast?.classList.add("hidden");
  }, dismissMs);
}

function createTeamIdFromName(name, existingTeams) {
  const base = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "team";
  const existingIds = new Set((existingTeams || []).map((team) => String(team.id || "")));
  let candidate = base;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function createSupportTeamRecord(input, existingTeams) {
  const badgeClasses = ["blue", "green", "purple", "orange"];
  const name = String(input?.name || "").trim();
  const lead = String(input?.lead || "").trim();
  const email = String(input?.email || "").trim();
  const id = createTeamIdFromName(name, existingTeams);
  const badge = (name.match(/[A-Za-z0-9]/)?.[0] || "T").toUpperCase();
  const badgeClass = badgeClasses[(existingTeams?.length || 0) % badgeClasses.length];
  return {
    id,
    name,
    badge,
    badgeClass,
    members: 1,
    activeTickets: 0,
    lead: lead || "Team Lead",
    leadRole: "Support Staff",
    email: email || "lead@campus.edu",
    phone: "+1 (555) 000-0000",
    permissions: 1,
    stats: { active: 0, resolved: 0, avgTime: "N/A", satisfaction: "N/A" },
    staffMembers: [
      {
        name: lead || "Team Lead",
        role: "Support Staff",
        email: email || "lead@campus.edu",
        phone: "+1 (555) 000-0000",
        activeTickets: 0,
      },
    ],
  };
}

/* Extra frontend-only function disabled: support team creation has no backend route yet.
async function persistSupportTeamCreate(team) {
  // new function from frontend
  // BACKEND NOTE:
  // Expected endpoint: POST /api/admin/support_teams
  // Expected behavior: return created team (id, members, stats, staffMembers) to replace optimistic local record.
  try {
    const response = await fetch(resolveApiUrl("/api/admin/support_teams"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(team),
    });
    return response.ok;
  } catch {
    return false;
  }
}
*/

function openAddTeamModal() {
  if (!addTeamModal) return;
  addTeamModal.classList.remove("hidden");
  addTeamNameInput?.focus();
}

function closeAddTeamModal() {
  if (!addTeamModal) return;
  addTeamModal.classList.add("hidden");
}

function resetAddTeamErrors() {
  if (addTeamNameError) addTeamNameError.textContent = "";
  if (addTeamLeadError) addTeamLeadError.textContent = "";
  if (addTeamLeadEmailError) addTeamLeadEmailError.textContent = "";
}

function validateAddTeamForm(teams, payload) {
  resetAddTeamErrors();
  let hasError = false;
  if (!payload.name) {
    if (addTeamNameError) addTeamNameError.textContent = "Team name is required.";
    hasError = true;
  }
  const duplicate = teams.some(
    (team) => String(team.name || "").trim().toLowerCase() === payload.name.toLowerCase()
  );
  if (duplicate) {
    if (addTeamNameError) addTeamNameError.textContent = "Team name already exists.";
    hasError = true;
  }
  if (payload.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      if (addTeamLeadEmailError) addTeamLeadEmailError.textContent = "Please enter a valid email.";
      hasError = true;
    }
  }
  return !hasError;
}

/* Extra frontend-only function disabled: add team flow has no backend route yet.
async function handleAddSupportTeam(payload) {
  // new function from frontend
  const currentState = supportTeamsState || mockAdminData.supportTeams;
  const teams = Array.isArray(currentState?.teams) ? currentState.teams : [];
  if (!validateAddTeamForm(teams, payload)) {
    showUpdateToast({ title: "Team not added", detail: "Fix form errors and try again.", tone: "warning" });
    return;
  }
  const newTeam = createSupportTeamRecord(payload, teams);
  const nextState = {
    ...currentState,
    // BACKEND NOTE: local-first optimistic insert for preview mode; backend response should become source of truth.
    teams: [...teams, newTeam],
  };
  supportTeamsState = nextState;
  activeSupportTeamId = newTeam.id;
  activeSupportTab = "groups";
  renderSupportTeams(nextState);
  activateAdminPage("support-team-detail");
  window.history.replaceState(null, "", "#support-team-detail");
  const persisted = await persistSupportTeamCreate(newTeam);
  showUpdateToast({
    title: persisted ? "Team added" : "Team added locally",
    detail: persisted ? `${newTeam.name} has been created.` : `${newTeam.name} is available in this session.`,
    tone: persisted ? "success" : "warning",
  });
  closeAddTeamModal();
}
*/

function clearAddStaffFormError() {
  if (!(addStaffFormError instanceof HTMLElement)) return;
  addStaffFormError.textContent = "";
  addStaffFormError.classList.add("hidden");
}

function setAddStaffFormError(message) {
  if (!(addStaffFormError instanceof HTMLElement)) return;
  addStaffFormError.textContent = message;
  addStaffFormError.classList.remove("hidden");
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function openAddStaffModal(teamName = "") {
  if (!(addStaffModal instanceof HTMLElement)) return;
  if (addStaffTeamHint instanceof HTMLElement) {
    addStaffTeamHint.textContent = teamName
      ? `Add a new support staff for ${teamName}.`
      : "Create a new support staff profile.";
  }
  if (addStaffForm instanceof HTMLFormElement) addStaffForm.reset();
  clearAddStaffFormError();
  addStaffModal.classList.remove("hidden");
  if (addStaffNameInput instanceof HTMLInputElement) addStaffNameInput.focus();
}

function closeAddStaffModal() {
  if (!(addStaffModal instanceof HTMLElement)) return;
  addStaffModal.classList.add("hidden");
  clearAddStaffFormError();
}

function createSupportStaffRecord(input) {
  const name = String(input?.name || "").trim();
  const role = String(input?.role || "").trim() || "Support Staff";
  const email = String(input?.email || "").trim() || "staff@campus.edu";
  const phone = String(input?.phone || "").trim() || "+1 (555) 000-0000";
  return {
    name,
    role,
    email,
    // BACKEND NOTE: placeholder until backend returns canonical phone/profile enrichment.
    phone,
    activeTickets: 0,
  };
}

/* Extra frontend-only function disabled: support staff creation has no backend route yet.
async function persistSupportStaffCreate(teamId, staff) {
  // new function from frontend
  // BACKEND NOTE:
  // Expected endpoint: POST /api/admin/support_teams/:teamId/staff
  // Expected behavior: return created staff member and updated team counters.
  try {
    const response = await fetch(resolveApiUrl(`/api/admin/support_teams/${encodeURIComponent(teamId)}/staff`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(staff),
    });
    if (response.ok) return { ok: true };
    let errorText = "";
    try {
      const body = await response.json();
      errorText = String(body?.message || body?.error || "").trim();
    } catch {
      errorText = "";
    }
    return {
      ok: false,
      message: errorText || `Request failed (${response.status}).`,
    };
  } catch (error) {
    return {
      ok: false,
      message: `Network issue: ${String(error?.message || "Unable to reach API.")}`,
    };
  }
}
*/

/* Extra frontend-only function disabled: add staff flow has no backend route yet.
async function handleAddStaffInTeamSubmit() {
  // new function from frontend
  const currentState = supportTeamsState || mockAdminData.supportTeams;
  const teams = Array.isArray(currentState?.teams) ? currentState.teams : [];
  const teamIndex = teams.findIndex((team) => String(team.id) === String(activeSupportTeamId));
  if (teamIndex < 0) {
    setAddStaffFormError("Select a team before adding a staff member.");
    return;
  }
  const selectedTeam = teams[teamIndex];
  const normalizedName =
    addStaffNameInput instanceof HTMLInputElement ? String(addStaffNameInput.value || "").trim() : "";
  if (!normalizedName) {
    setAddStaffFormError("Staff name is required.");
    if (addStaffNameInput instanceof HTMLInputElement) addStaffNameInput.focus();
    return;
  }
  const nextEmail = addStaffEmailInput instanceof HTMLInputElement ? String(addStaffEmailInput.value || "").trim() : "";
  if (!isValidEmail(nextEmail)) {
    setAddStaffFormError("Please enter a valid email format.");
    if (addStaffEmailInput instanceof HTMLInputElement) addStaffEmailInput.focus();
    return;
  }
  const duplicate = (Array.isArray(selectedTeam.staffMembers) ? selectedTeam.staffMembers : []).some(
    (staff) => String(staff.name || "").trim().toLowerCase() === normalizedName.toLowerCase()
  );
  if (duplicate) {
    setAddStaffFormError("A staff member with this name already exists in the selected team.");
    return;
  }
  clearAddStaffFormError();
  if (addStaffSubmitBtn instanceof HTMLButtonElement) {
    addStaffSubmitBtn.disabled = true;
    addStaffSubmitBtn.textContent = "Adding...";
  }
  const staffRole = addStaffRoleInput instanceof HTMLInputElement ? String(addStaffRoleInput.value || "").trim() : "";
  const staffPhone =
    addStaffPhoneInput instanceof HTMLInputElement ? String(addStaffPhoneInput.value || "").trim() : "";
  const newStaff = createSupportStaffRecord({
    name: normalizedName,
    role: staffRole,
    email: nextEmail,
    phone: staffPhone,
  });
  const currentStaff = Array.isArray(selectedTeam.staffMembers) ? selectedTeam.staffMembers : [];
  const nextTeam = {
    ...selectedTeam,
    staffMembers: [...currentStaff, newStaff],
    members: currentStaff.length + 1,
    stats: {
      ...(selectedTeam.stats || {}),
      active: Number(selectedTeam?.stats?.active || 0) + Number(newStaff.activeTickets || 0),
    },
  };
  const nextTeams = [...teams];
  nextTeams[teamIndex] = nextTeam;
  const nextState = {
    ...currentState,
    teams: nextTeams,
  };
  supportTeamsState = nextState;
  renderSupportTeams(nextState);
  const persistResult = await persistSupportStaffCreate(selectedTeam.id, newStaff);
  if (addStaffSubmitBtn instanceof HTMLButtonElement) {
    addStaffSubmitBtn.disabled = false;
    addStaffSubmitBtn.textContent = "Add Staff";
  }
  closeAddStaffModal();
  showUpdateToast({
    title: persistResult.ok ? "Staff added" : "Staff added locally",
    detail: persistResult.ok
      ? `${newStaff.name} was added to ${selectedTeam.name}.`
      : `${newStaff.name} was added. Sync failed: ${persistResult.message}`,
    tone: persistResult.ok ? "success" : "warning",
  });
}
*/

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? "");
}

function parseTicketCreatedDate(ticket) {
  const value = ticket?.created_at || ticket?.submitted_at || ticket?.updated_at;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function isTicketInActiveRange(ticket, range) {
  const createdDate = parseTicketCreatedDate(ticket);
  if (!createdDate) return false;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  if (range === "today") return createdDate >= todayStart && createdDate <= todayEnd;
  if (range === "week") {
    const weekStart = startOfDay(new Date(now));
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = endOfDay(new Date(weekStart));
    weekEnd.setDate(weekStart.getDate() + 6);
    return createdDate >= weekStart && createdDate <= weekEnd;
  }
  if (range === "month") {
    const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return createdDate >= monthStart && createdDate <= monthEnd;
  }
  if (range === "year") {
    const yearStart = startOfDay(new Date(now.getFullYear(), 0, 1));
    const yearEnd = endOfDay(new Date(now.getFullYear(), 11, 31));
    return createdDate >= yearStart && createdDate <= yearEnd;
  }
  return true;
}

function getOverviewTicketsByRange() {
  return allTicketsState.filter((ticket) => isTicketInActiveRange(ticket, activeRange));
}

function computeOverviewDataFromTickets(tickets) {
  // BACKEND NOTE (KPI CONTRACT):
  // Production response should include server-computed KPI fields per ticket or aggregate:
  // - first_response_at
  // - resolved_at
  // - sla_target_minutes
  // Current client values are approximations derived from created/submitted vs updated timestamps.
  const list = Array.isArray(tickets) ? tickets : [];
  const metrics = {
    totalTickets: list.length,
    open: list.filter((ticket) => ticket.status === "Open").length,
    inProgress: list.filter((ticket) => ticket.status === "In Progress").length,
    resolved: list.filter((ticket) => ticket.status === "Resolved").length,
  };
  const categoryMap = new Map();
  const priorityMap = new Map([
    ["High", 0],
    ["Medium", 0],
    ["Low", 0],
  ]);
  const departmentPerformanceMap = new Map();
  const createdByDay = new Array(7).fill(0);
  const resolvedByDay = new Array(7).fill(0);
  let resolutionMinutesTotal = 0;
  let resolvedCount = 0;
  let firstResponseWithinSlaCount = 0;
  let firstResponseEligibleCount = 0;
  const firstResponseSlaMinutes = 120;

  list.forEach((ticket) => {
    const category = String(ticket.category || "General");
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    const rawPriority = String(ticket.priority || "Medium").toLowerCase();
    const normalizedPriority =
      rawPriority === "critical" || rawPriority === "urgent"
        ? "High"
        : rawPriority === "low"
          ? "Low"
          : rawPriority === "high"
            ? "High"
            : "Medium";
    priorityMap.set(normalizedPriority, Number(priorityMap.get(normalizedPriority) || 0) + 1);
    const createdDate = parseTicketCreatedDate(ticket);
    if (createdDate) createdByDay[createdDate.getDay()] += 1;
    const updatedDate = new Date(ticket.updated_at || ticket.created_at || ticket.submitted_at);
    if (createdDate && !Number.isNaN(updatedDate.getTime())) {
      const responseMinutes = Math.max(0, (updatedDate.getTime() - createdDate.getTime()) / 60000);
      firstResponseEligibleCount += 1;
      if (responseMinutes <= firstResponseSlaMinutes) firstResponseWithinSlaCount += 1;
    }
    if (ticket.status === "Resolved" && !Number.isNaN(updatedDate.getTime())) {
      resolvedByDay[updatedDate.getDay()] += 1;
      if (createdDate) {
        const resolveMinutes = Math.max(0, (updatedDate.getTime() - createdDate.getTime()) / 60000);
        resolutionMinutesTotal += resolveMinutes;
        resolvedCount += 1;
        const departmentLabel = String(ticket.assignedTeam || ticket.assigned_team || "Unassigned");
        const current = departmentPerformanceMap.get(departmentLabel) || { label: departmentLabel, volume: 0, minutesTotal: 0 };
        current.volume += 1;
        current.minutesTotal += resolveMinutes;
        departmentPerformanceMap.set(departmentLabel, current);
      }
    }
  });

  const categoryDistribution = Array.from(categoryMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const total = Math.max(metrics.totalTickets, 1);
  const priorityDistribution = ["High", "Medium", "Low"].map((label) => {
    const value = Number(priorityMap.get(label) || 0);
    const percent = Math.round((value / total) * 100);
    return {
      label,
      percent,
      className: label.toLowerCase(),
    };
  });
  const avgResolutionHours = resolvedCount ? resolutionMinutesTotal / resolvedCount / 60 : 0;
  const avgResolutionTime =
    avgResolutionHours === 0 ? "0h" : avgResolutionHours >= 10 ? `${Math.round(avgResolutionHours)}h` : `${avgResolutionHours.toFixed(1)}h`;
  const slaResponseRate = firstResponseEligibleCount
    ? Math.round((firstResponseWithinSlaCount / firstResponseEligibleCount) * 100)
    : 0;
  const topDepartmentPerformance = Array.from(departmentPerformanceMap.values())
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6)
    .map((entry, index) => {
      const avgHours = entry.minutesTotal / Math.max(entry.volume, 1) / 60;
      const avgLabel = avgHours >= 10 ? `${Math.round(avgHours)}h` : `${avgHours.toFixed(1)}h`;
      const growthPercent = Math.max(3, Math.min(25, Math.round(24 / Math.max(avgHours, 1)) - index));
      return { label: entry.label, volume: entry.volume, avgResolutionTime: avgLabel, growthPercent };
    });
  return {
    metrics,
    overviewKpis: {
      avgResolutionTime,
      slaResponseRate,
    },
    categoryDistribution,
    priorityDistribution,
    topDepartmentPerformance,
    weeklyTrend: {
      created: createdByDay.slice(1).concat(createdByDay[0]),
      resolved: resolvedByDay.slice(1).concat(resolvedByDay[0]),
    },
  };
}

function formatDateTime(value) {
  if (sharedTicketView.formatDateTime) return sharedTicketView.formatDateTime(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function toDetailPriorityClass(priority) {
  if (sharedTicketView.priorityClass) return sharedTicketView.priorityClass(priority);
  const value = String(priority || "").toLowerCase();
  if (value === "high" || value === "urgent") return "priority-high";
  if (value === "low") return "priority-low";
  return "priority-medium";
}

function toBadgeClass(status) {
  if (sharedTicketView.badgeClass) return sharedTicketView.badgeClass(status);
  const value = String(status || "").toLowerCase().replaceAll(" ", "");
  if (value === "resolved" || value === "closed") return "badge-resolved";
  if (value === "inprogress") return "badge-inprogress";
  return "badge-new";
}

function syncOverviewRowControls(ticket) {
  const ticketsBody = document.getElementById("manageTicketsBody");
  if (!ticketsBody) return;
  const controls = Array.from(ticketsBody.querySelectorAll("[data-ticket-id]"));
  const control = controls.find((node) => String(node.getAttribute("data-ticket-id") || "") === String(ticket.ticketId));
  const row = control?.closest("tr");
  if (!(row instanceof HTMLTableRowElement)) return;
  const statusSelect = row.querySelector('select[data-control="status"]');
  const prioritySelect = row.querySelector('select[data-control="priority"]');
  const teamSelect = row.querySelector('select[data-control="team"]');
  const selectCheckbox = row.querySelector('input[data-control="select-ticket"]');
  if (statusSelect instanceof HTMLSelectElement) statusSelect.value = ticket.status;
  if (prioritySelect instanceof HTMLSelectElement) prioritySelect.value = ticket.priority;
  if (teamSelect instanceof HTMLSelectElement) teamSelect.value = ticket.assignedTeam;
  if (selectCheckbox instanceof HTMLInputElement) {
    selectCheckbox.checked = selectedManageTicketIds.has(String(ticket.ticketId));
  }
}


function buildLineCoordinates(values, height = 180, width = 700, maxValue = 1, startX = 20) {
  const safeValues = Array.isArray(values) && values.length ? values : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(maxValue, 1);
  const stepX = width / Math.max(safeValues.length - 1, 1);
  return safeValues.map((value, index) => {
    const x = startX + index * stepX;
    const y = 20 + height - (Number(value || 0) / max) * height;
    return { x: Math.round(x), y: Math.round(y), value: Number(value || 0), index };
  });
}

function buildPolylinePointsFromCoordinates(coords) {
  return coords.map((coord) => `${coord.x},${coord.y}`).join(" ");
}

function getOrCreateChartTooltip() {
  let tooltip = document.getElementById("chartHoverTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "chartHoverTooltip";
    tooltip.className = "chart-hover-tooltip hidden";
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function showChartTooltip(html, clientX, clientY) {
  const tooltip = getOrCreateChartTooltip();
  tooltip.innerHTML = html;
  tooltip.classList.remove("hidden");
  tooltip.classList.remove("line", "pie", "bar");
  const offset = 12;
  tooltip.style.left = `${clientX + offset}px`;
  tooltip.style.top = `${clientY + offset}px`;
}

function hideChartTooltip() {
  const tooltip = getOrCreateChartTooltip();
  tooltip.classList.add("hidden");
}

function bindHoverTooltip(element, formatter, variant = "") {
  if (!element) return;
  element.addEventListener("mousemove", (event) => {
    showChartTooltip(formatter(), event.clientX, event.clientY);
    const tooltip = getOrCreateChartTooltip();
    if (variant) tooltip.classList.add(variant);
  });
  element.addEventListener("mouseleave", hideChartTooltip);
}

function bindPieHoverTooltip(pieElement, priorities, totalTickets) {
  if (!pieElement || !Array.isArray(priorities) || !priorities.length) return;
  let progress = 0;
  const slices = priorities.map((item) => {
    const start = progress;
    progress += Number(item.percent || 0);
    return { ...item, start, end: progress };
  });

  pieElement.addEventListener("mousemove", (event) => {
    const rect = pieElement.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const radius = rect.width / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) {
      hideChartTooltip();
      return;
    }
    const degFromTopClockwise = (Math.atan2(dy, dx) * (180 / Math.PI) + 450) % 360;
    const percent = degFromTopClockwise / 3.6;
    const slice = slices.find((entry) => percent >= entry.start && percent < entry.end) || slices[0];
    const count = Math.round((Number(slice.percent || 0) / 100) * Number(totalTickets || 0));
    showChartTooltip(`${escapeHtml(slice.label)} : ${count}`, event.clientX, event.clientY);
    getOrCreateChartTooltip().classList.add("pie");
  });
  pieElement.addEventListener("mouseleave", hideChartTooltip);
}

function formatPercent(value, total) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function renderOverviewTrendChart(createdValues, resolvedValues) {
  const canvas = document.getElementById("overviewTrendCanvas");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  if (typeof window.Chart === "undefined") return;

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (overviewTrendChart) {
    overviewTrendChart.destroy();
    overviewTrendChart = null;
  }

  const tooltipStyle = {
    backgroundColor: "#fff",
    borderColor: "#d5dee8",
    borderWidth: 1,
    titleColor: "#24303d",
    bodyColor: "#24303d",
    titleFont: { size: 13, weight: "600" },
    bodyFont: { size: 12 },
    padding: 10,
    displayColors: false,
  };

  overviewTrendChart = new window.Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Created",
          data: createdValues,
          borderColor: "#3b82f6",
          backgroundColor: "#3b82f6",
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHitRadius: 18,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          cubicInterpolationMode: "monotone",
          tension: 0.36,
        },
        {
          label: "Resolved",
          data: resolvedValues,
          borderColor: "#22c55e",
          backgroundColor: "#22c55e",
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHitRadius: 18,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          cubicInterpolationMode: "monotone",
          tension: 0.36,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1200,
        easing: "easeOutCubic",
      },
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle,
          callbacks: {
            title: (items) => items?.[0]?.label || "",
            label: (context) => `${context.dataset.label} : ${context.formattedValue}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#6b7280", font: { size: 12 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#e5e7eb", borderDash: [2, 4] },
          ticks: { color: "#6b7280", font: { size: 12 }, precision: 0 },
        },
      },
    },
  });
}

function animateOverviewCharts() {
  const bars = document.querySelectorAll("#overviewCategoryBars .mini-bar");
  bars.forEach((bar, index) => {
    bar.style.animationDelay = `${index * 90}ms`;
    bar.classList.remove("flow-rise");
    // force restart
    void bar.offsetWidth;
    bar.classList.add("flow-rise");
  });

  const pie = document.getElementById("overviewPriorityPie");
  if (pie) {
    pie.classList.remove("flow-spin");
    void pie.offsetWidth;
    pie.classList.add("flow-spin");
  }

  // Weekly trend now uses Chart.js canvas animation.
}

function renderOverview(overviewData) {
  const metrics = overviewData?.metrics || {};
  const overviewKpis = overviewData?.overviewKpis || {};
  setText("overviewTotalTickets", metrics.totalTickets ?? 0);
  setText("overviewOpenTickets", metrics.open ?? 0);
  setText("overviewInProgressTickets", metrics.inProgress ?? 0);
  setText("overviewResolvedTickets", metrics.resolved ?? 0);
  setText("overviewAvgResolutionTime", overviewKpis.avgResolutionTime ?? "0h");
  setText("overviewSlaResponse", `${overviewKpis.slaResponseRate ?? 0}%`);

  const bars = document.getElementById("overviewCategoryBars");
  const yAxis = document.getElementById("overviewCategoryYAxis");
  const xAxis = document.getElementById("overviewCategoryXAxis");
  if (bars) {
    const categories = Array.isArray(overviewData?.categoryDistribution) ? overviewData.categoryDistribution : [];
    const max = Math.max(...categories.map((item) => Number(item.value || 0)), 1);
    const total = categories.reduce((sum, item) => sum + Number(item.value || 0), 0);
    if (yAxis) {
      const ticks = [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0];
      yAxis.innerHTML = ticks.map((tick) => `<span>${tick}</span>`).join("");
    }
    if (xAxis) {
      xAxis.innerHTML = categories
        .map((item) => `<span title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>`)
        .join("");
    }
    bars.innerHTML = categories
      .map((item) => {
        const value = Number(item.value || 0);
        const heightPct = Math.max(12, Math.round((value / max) * 100));
        const share = formatPercent(value, total);
        return `<span class="mini-bar" data-label="${escapeHtml(item.label)}" data-value="${value}" data-share="${share}" style="height:${heightPct}%"></span>`;
      })
      .join("");
    bars.querySelectorAll(".mini-bar").forEach((bar) => {
      bindHoverTooltip(bar, () => {
        const label = bar.getAttribute("data-label") || "Category";
        const value = bar.getAttribute("data-value") || "0";
        return `${label}<br/>count : ${value}`;
      }, "bar");
    });
  }

  const priorityLegend = document.getElementById("overviewPriorityLegend");
  const priorityPie = document.getElementById("overviewPriorityPie");
  const priorities = Array.isArray(overviewData?.priorityDistribution)
    ? overviewData.priorityDistribution
    : [];
  if (priorityLegend) {
    priorityLegend.innerHTML = priorities
      .map(
        (item) =>
          `<p><span class="dot ${escapeHtml(item.className)}"></span>${escapeHtml(item.label)} ${escapeHtml(
            item.percent
          )}%</p>`
      )
      .join("");
    const totalTickets = Number(metrics.totalTickets || 0);
    priorityLegend.querySelectorAll("p").forEach((entry, index) => {
      const item = priorities[index];
      if (!item) return;
      bindHoverTooltip(entry, () => {
        const estCount = Math.round((Number(item.percent || 0) / 100) * totalTickets);
        return `${escapeHtml(item.label)} : ${estCount}`;
      }, "pie");
    });
  }
  if (priorityPie && priorities.length) {
    let progress = 0;
    const gradientParts = priorities.map((item) => {
      const color =
        item.className === "high"
          ? "#ef4444"
          : item.className === "medium"
            ? "#f97316"
            : "#6b7280";
      const start = progress;
      progress += Number(item.percent || 0);
      return `${color} ${start}% ${progress}%`;
    });
    priorityPie.style.background = `conic-gradient(${gradientParts.join(", ")})`;
    bindPieHoverTooltip(priorityPie, priorities, Number(metrics.totalTickets || 0));
  }

  const topCategoryPerformance = document.getElementById("overviewTopCategoryPerformance");
  if (topCategoryPerformance) {
    const rows = Array.isArray(overviewData?.topDepartmentPerformance) ? overviewData.topDepartmentPerformance : [];
    const initialsFromLabel = (label) => {
      const words = String(label || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (!words.length) return "NA";
      if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
      return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
    };
    topCategoryPerformance.innerHTML = rows.length
      ? rows
          .map(
            (entry) => `
          <article class="top-category-row">
            <div class="top-category-main">
              <span class="top-category-avatar">${escapeHtml(initialsFromLabel(entry.label))}</span>
              <div class="top-category-copy">
                <p class="top-category-name">${escapeHtml(entry.label)}</p>
                <p class="top-category-summary">${escapeHtml(String(entry.volume))} resolved &middot; Avg: ${escapeHtml(
                  entry.avgResolutionTime
                )}</p>
              </div>
            </div>
            <div>
              <p class="top-category-meta">${escapeHtml(String(entry.volume))} tickets</p>
              <p class="top-category-growth">+${escapeHtml(String(entry.growthPercent || 0))}%</p>
            </div>
          </article>
        `
          )
          .join("")
      : `
        <article class="top-category-empty-state" role="status" aria-live="polite">
          <div class="top-category-empty-header">
            <span class="top-category-empty-dot" aria-hidden="true"></span>
            <p class="top-category-empty-title">No department performance data yet</p>
          </div>
          <p class="top-category-empty-copy">Assign tickets to a team and mark them resolved to see performance here.</p>
        </article>
      `;
  }

  const trend = overviewData?.weeklyTrend || {};
  const createdValues = Array.isArray(trend.created) ? trend.created : [0, 0, 0, 0, 0, 0, 0];
  const resolvedValues = Array.isArray(trend.resolved) ? trend.resolved : [0, 0, 0, 0, 0, 0, 0];
  renderOverviewTrendChart(createdValues, resolvedValues);

  animateOverviewCharts();
}

function recalculateOverviewMetrics() {
  overviewTicketsState = getOverviewTicketsByRange();
  renderOverview(computeOverviewDataFromTickets(overviewTicketsState));
}

async function refreshOverviewForActiveRange() {
  recalculateOverviewMetrics();
}

async function persistOverviewTicketUpdate(ticket) {
  try {
    const accessToken = await ensureAdminAccessToken();
    const response = await fetch(`${API_BASE}/api/tickets_update/${encodeURIComponent(ticket.ticketId)}`, {
      method: "PATCH",
      headers: apiHeaders({ "Content-Type": "application/json" }, accessToken),
      body: JSON.stringify({
        status: ticket.status,
        priority: ticket.priority,
        assignedTeam: ticket.assignedTeam,
      }),
    });
    if (!response.ok) return false;
    const data = await response.json().catch(() => null);
    const savedTicket = data?.ticket ? normalizeAdminTicket(data.ticket) : null;
    if (savedTicket) Object.assign(ticket, savedTicket);
    return true;
  } catch {
    return false;
  }
}

/* Extra frontend-only function disabled: access request approval has no backend route yet. */
async function persistAccessRequestDecision({ requestId, status, reviewedBy }) {
  // new function from frontend
  // BACKEND NOTE:
  // Expected endpoint: PATCH /api/admin/access_requests/:requestId
  // Expected behavior: persist approval/rejection and optionally return updated team/staff payload.
  if (!API_BASE_CONFIGURED || !requestId) return true;
  try {
    const response = await fetch(`${API_BASE}/api/admin/access_requests/${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewedBy }),
    });
    return response.ok;
  } catch {
    return false;
  }
}


function renderTicketDetails(ticket) {
  if (!adminTicketModalContent) return;
  activeOverviewModalTicketId = ticket.ticketId;
  const extraSectionHtml = `
    <section class="detail-block">
      <h3>Admin Update Controls</h3>
      <div class="admin-modal-controls">
        <label>
          <span>Status</span>
          <select id="adminModalStatusSelect" class="table-select">
            ${overviewStatusOptions
              .map(
                (status) =>
                  `<option value="${escapeHtml(status)}" ${status === ticket.status ? "selected" : ""}>${escapeHtml(
                    status
                  )}</option>`
              )
              .join("")}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select id="adminModalPrioritySelect" class="table-select">
            ${overviewPriorityOptions
              .map(
                (priority) =>
                  `<option value="${escapeHtml(priority)}" ${priority === ticket.priority ? "selected" : ""}>${escapeHtml(
                    priority
                  )}</option>`
              )
              .join("")}
          </select>
        </label>
        <label>
          <span>Assigned Team</span>
          <select id="adminModalTeamSelect" class="table-select">
            ${overviewTeamOptions
              .map(
                (team) =>
                  `<option value="${escapeHtml(team)}" ${team === ticket.assignedTeam ? "selected" : ""}>${escapeHtml(
                    team
                  )}</option>`
              )
              .join("")}
          </select>
        </label>
      </div>
      <div class="detail-actions">
        <button class="table-btn update" type="button" data-modal-control="update-ticket">Update Ticket</button>
      </div>
    </section>
  `;
  adminTicketModalContent.innerHTML = sharedTicketView.renderTicketDetailLayout
    ? sharedTicketView.renderTicketDetailLayout(ticket, { extraSectionHtml })
    : "";
}

function bindOverviewInteractions() {
  const ticketsBody = document.getElementById("manageTicketsBody");
  if (!ticketsBody) return;

  ticketsBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const ticketId = String(target.dataset.ticketId || "");
    const ticket = allTicketsState.find((item) => item.ticketId === ticketId);
    if (!ticket) return;
    const control = String(target.dataset.control || "");
    if (control === "view") {
      renderTicketDetails(ticket);
      openAdminModal();
      return;
    }

    if (control === "delete") {
      (async () => {
        const confirmMessage = `Delete ticket ${ticket.ticketId}? This action cannot be undone.`;
        if (!window.confirm(confirmMessage)) return;
        try {
          target.disabled = true;
          target.textContent = "Deleting...";
          const accessToken = await ensureAdminAccessToken();
          const resp = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(ticket.ticketId)}`, {
            method: "DELETE",
            headers: apiHeaders({}, accessToken),
          });
          if (resp.ok) {
            showUpdateToast({ title: "Ticket deleted", detail: `${ticket.ticketId} removed`, tone: "success" });
            await loadAdminData();
          } else {
            const txt = await resp.text().catch(() => "");
            showUpdateToast({ title: "Delete failed", detail: lastAdminApiError || `Request failed (${resp.status}): ${txt}`, tone: "warning" });
          }
        } catch (err) {
          showUpdateToast({ title: "Delete failed", detail: String(err?.message || err), tone: "warning" });
        } finally {
          target.disabled = false;
          target.textContent = "Delete";
        }
      })();
      return;
    }

    if (control !== "update") return;

    const row = target.closest("tr");
    if (!(row instanceof HTMLTableRowElement)) return;
    const statusSelect = row.querySelector('select[data-control="status"]');
    const prioritySelect = row.querySelector('select[data-control="priority"]');
    const teamSelect = row.querySelector('select[data-control="team"]');
    if (!(statusSelect instanceof HTMLSelectElement)) return;
    if (!(prioritySelect instanceof HTMLSelectElement)) return;
    if (!(teamSelect instanceof HTMLSelectElement)) return;

    const nextStatus = String(statusSelect.value || ticket.status);
    const nextPriority = String(prioritySelect.value || ticket.priority);
    const nextTeam = String(teamSelect.value || ticket.assignedTeam);
    applyTicketChanges(ticket, nextStatus, nextPriority, nextTeam, target);
  });

  ticketsBody.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.control !== "select-ticket") return;
    const ticketId = String(target.dataset.ticketId || "");
    if (!ticketId) return;
    if (target.checked) selectedManageTicketIds.add(ticketId);
    else selectedManageTicketIds.delete(ticketId);
    const selectAll = document.getElementById("manageSelectAll");
    if (selectAll instanceof HTMLInputElement) {
      const rows = Array.from(ticketsBody.querySelectorAll('input[data-control="select-ticket"]'));
      selectAll.checked = rows.length > 0 && rows.every((checkbox) => checkbox instanceof HTMLInputElement && checkbox.checked);
    }
    updateBulkSelectionUi();
  });

  adminTicketModalContent?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    if (target.dataset.modalControl !== "update-ticket") return;
    const ticket = allTicketsState.find((item) => item.ticketId === activeOverviewModalTicketId);
    if (!ticket) return;
    const statusSelect = document.getElementById("adminModalStatusSelect");
    const prioritySelect = document.getElementById("adminModalPrioritySelect");
    const teamSelect = document.getElementById("adminModalTeamSelect");
    if (!(statusSelect instanceof HTMLSelectElement)) return;
    if (!(prioritySelect instanceof HTMLSelectElement)) return;
    if (!(teamSelect instanceof HTMLSelectElement)) return;

    const nextStatus = String(statusSelect.value || ticket.status);
    const nextPriority = String(prioritySelect.value || ticket.priority);
    const nextTeam = String(teamSelect.value || ticket.assignedTeam);
    await applyTicketChanges(ticket, nextStatus, nextPriority, nextTeam, target);
  });

  const selectAllCheckbox = document.getElementById("manageSelectAll");
  selectAllCheckbox?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const checkboxes = Array.from(ticketsBody.querySelectorAll('input[data-control="select-ticket"]'));
    checkboxes.forEach((checkbox) => {
      if (!(checkbox instanceof HTMLInputElement)) return;
      checkbox.checked = target.checked;
      const ticketId = String(checkbox.dataset.ticketId || "");
      if (!ticketId) return;
      if (target.checked) selectedManageTicketIds.add(ticketId);
      else selectedManageTicketIds.delete(ticketId);
    });
    updateBulkSelectionUi();
  });

  openBulkEditBtn?.addEventListener("click", () => {
    const selectedTickets = getSelectedManageTickets();
    if (!selectedTickets.length) {
      showUpdateToast({ title: "No tickets selected", detail: "Select at least one ticket.", tone: "warning" });
      return;
    }
    openBulkEditDrawer();
    updateBulkSelectionUi();
  });

  bulkDrawerStatusSelect?.addEventListener("change", updateBulkDrawerSummary);
  bulkDrawerStatusSelect?.addEventListener("change", updateBulkApplyState);
  bulkDrawerTeamSelect?.addEventListener("change", updateBulkDrawerSummary);
  bulkDrawerTeamSelect?.addEventListener("change", updateBulkApplyState);

  bulkDrawerClearSelection?.addEventListener("click", () => {
    selectedManageTicketIds.clear();
    renderManageTickets(allTicketsState);
    const selectAll = document.getElementById("manageSelectAll");
    if (selectAll instanceof HTMLInputElement) selectAll.checked = false;
    closeBulkEditDrawer();
    updateBulkSelectionUi();
  });

  bulkDrawerApplyBtn?.addEventListener("click", async () => {
    const nextStatus =
      bulkDrawerStatusSelect instanceof HTMLSelectElement
        ? String(bulkDrawerStatusSelect.value || "").trim()
        : "";
    const nextTeam =
      bulkDrawerTeamSelect instanceof HTMLSelectElement
        ? String(bulkDrawerTeamSelect.value || "").trim()
        : "";
    if (!nextStatus && !nextTeam) {
      showUpdateToast({ title: "No changes selected", detail: "Choose status, team, or both.", tone: "warning" });
      return;
    }
    const selectedTickets = getSelectedManageTickets();
    if (!selectedTickets.length) {
      showUpdateToast({ title: "No tickets selected", detail: "Select at least one ticket.", tone: "warning" });
      return;
    }
    if (bulkDrawerApplyBtn instanceof HTMLButtonElement) {
      bulkDrawerApplyBtn.disabled = true;
      bulkDrawerApplyBtn.textContent = "Applying...";
    }
    await Promise.all(
      selectedTickets.map((ticket) => applyTicketChanges(ticket, nextStatus, ticket.priority, nextTeam, null, true))
    );
    if (bulkDrawerApplyBtn instanceof HTMLButtonElement) {
      bulkDrawerApplyBtn.disabled = false;
      bulkDrawerApplyBtn.textContent = "Apply Changes";
    }
    showUpdateToast({
      title: "Bulk update complete",
      detail: `${selectedTickets.length} ticket(s) updated.`,
      tone: "success",
    });
    selectedManageTicketIds.clear();
    renderManageTickets(allTicketsState);
    const selectAll = document.getElementById("manageSelectAll");
    if (selectAll instanceof HTMLInputElement) selectAll.checked = false;
    if (bulkDrawerStatusSelect instanceof HTMLSelectElement) bulkDrawerStatusSelect.value = "";
    if (bulkDrawerTeamSelect instanceof HTMLSelectElement) bulkDrawerTeamSelect.value = "";
    closeBulkEditDrawer();
    updateBulkSelectionUi();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.closeAdminModal === "true") closeAdminModal();
    if (target.dataset.closeBulkDrawer === "true") closeBulkEditDrawer();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAdminModal();
      closeBulkEditDrawer();
    }
  });
}

function normalizeAdminTicket(ticket) {
  const source = ticket || {};
  const rawStatus = String(source.status || "Open");
  const normalizedStatus =
    rawStatus === "New" ? "Open" : rawStatus === "InProgress" ? "In Progress" : rawStatus;
  const createdAt = source.created_at || source.createdAt || source.submitted_at || source.updated_at || source.updatedAt || new Date().toISOString();
  const updatedAt = source.updated_at || source.updatedAt || createdAt;
  const email = source.email || "";
  return {
    ticketId: source.ticketId || source.ticket_id || source.id || "N/A",
    user: source.user || source.name || source.requester || source.requesterName || String(email).split("@")[0] || "N/A",
    email,
    issue: source.issue || source.subject || source.title || "No issue provided",
    title: source.title || source.subject || source.issue || "No issue provided",
    description: source.description || source.issue || source.subject || source.title || "No description provided",
    category: source.category || source.department || "General",
    priority: source.priority || "Medium",
    status: normalizedStatus || "Open",
    assignedTeam: source.assignedTeam || source.assigned_to || source.assignedTo || "Unassigned",
    hasImage: Boolean(source.hasImage || source.image),
    image: source.image || null,
    comments: Array.isArray(source.comments) ? source.comments : [],
    timeline: Array.isArray(source.timeline) ? source.timeline : [],
    created_at: createdAt,
    submitted_at: source.submitted_at || createdAt,
    updated_at: updatedAt,
  };
}

function renderManageTickets(tickets) {
  const manageBody = document.getElementById("manageTicketsBody");
  if (!manageBody) return;
  const list = Array.isArray(tickets) ? tickets : [];
  manageBody.innerHTML = list
    .map(
      (ticket) => `
      <tr>
        <td>
          <input
            type="checkbox"
            data-control="select-ticket"
            data-ticket-id="${escapeHtml(ticket.ticketId)}"
            ${selectedManageTicketIds.has(String(ticket.ticketId)) ? "checked" : ""}
            aria-label="Select ticket ${escapeHtml(ticket.ticketId)}"
          />
        </td>
        <td>${escapeHtml(ticket.ticketId)}</td>
        <td>${escapeHtml(ticket.user)}</td>
        <td>${escapeHtml(ticket.issue)}</td>
        <td>${escapeHtml(ticket.category)}</td>
        <td>
          <select class="table-select" data-control="priority" data-ticket-id="${escapeHtml(ticket.ticketId)}">
            ${overviewPriorityOptions
              .map(
                (priority) =>
                  `<option value="${escapeHtml(priority)}" ${priority === ticket.priority ? "selected" : ""}>${escapeHtml(
                    priority
                  )}</option>`
              )
              .join("")}
          </select>
        </td>
        <td>
          <select class="table-select" data-control="status" data-ticket-id="${escapeHtml(ticket.ticketId)}">
            ${overviewStatusOptions
              .map(
                (status) =>
                  `<option value="${escapeHtml(status)}" ${status === ticket.status ? "selected" : ""}>${escapeHtml(
                    status
                  )}</option>`
              )
              .join("")}
          </select>
        </td>
        <td>
          <select class="table-select" data-control="team" data-ticket-id="${escapeHtml(ticket.ticketId)}">
            ${overviewTeamOptions
              .map(
                (team) =>
                  `<option value="${escapeHtml(team)}" ${team === ticket.assignedTeam ? "selected" : ""}>${escapeHtml(
                    team
                  )}</option>`
              )
              .join("")}
          </select>
        </td>
        <td>
          <div class="table-actions">
            <button class="table-btn" type="button" data-control="view" data-ticket-id="${escapeHtml(
              ticket.ticketId
            )}">View</button>
            <button class="table-btn update" type="button" data-control="update" data-ticket-id="${escapeHtml(
              ticket.ticketId
            )}">Update</button>
            <button class="table-btn delete" type="button" data-control="delete" data-ticket-id="${escapeHtml(
              ticket.ticketId
            )}">Delete</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
  updateBulkSelectionUi();
}

function renderAnalytics(data) {
  const summary = data?.summary || {};
  setText("analyticsNewCount", summary.new ?? 0);
  setText("analyticsCompleteCount", summary.complete ?? 0);
  setText("analyticsStaffCount", summary.staff ?? 0);
  setText("analyticsUsersCount", summary.users ?? 0);
  setText("analyticsTicketsCount", summary.tickets ?? 0);

  const cards = document.getElementById("analyticsCards");
  if (!cards) return;
  const entries = Array.isArray(data?.cards) ? data.cards : [];
  cards.innerHTML = entries
    .map(
      (item) => `
      <article class="analytic-card">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.copy)}</p>
      </article>
    `
    )
    .join("");
}

function renderSupportTeams(data) {
  supportTeamsState = data;
  const addTeamButton = document.getElementById("addTeamBtn");
  const searchRow = document.getElementById("supportSearchRow");
  const grid = document.getElementById("supportTeamsGrid");
  const detail = document.getElementById("supportTeamDetail");
  const accessPanel = document.getElementById("supportAccessPanel");
  const accessBody = document.getElementById("supportAccessBody");
  const staffCards = document.getElementById("supportStaffCards");
  const groupsPanel = document.getElementById("supportGroupsPanel");
  const subtitle = document.getElementById("teamDetailSubtitle");
  const requestFilter = document.getElementById("supportRequestFilter");
  const searchInput = document.getElementById("supportTeamSearch");
  if (!grid || !detail || !accessPanel || !accessBody || !staffCards || !groupsPanel) return;
  const teams = Array.isArray(data?.teams) ? data.teams : [];
  const searchValue = String(searchInput?.value || "").trim().toLowerCase();
  const visibleTeams = teams.filter((team) => {
    if (!searchValue) return true;
    const teamFields = [team.name, team.lead, team.email, team.leadRole, team.phone];
    const staffFields = (Array.isArray(team.staffMembers) ? team.staffMembers : []).flatMap((staff) => [
      staff?.name,
      staff?.email,
      staff?.role,
      staff?.phone,
    ]);
    return [...teamFields, ...staffFields].some((item) => String(item || "").toLowerCase().includes(searchValue));
  });
  if (!visibleTeams.some((team) => String(team.id) === activeSupportTeamId)) {
    activeSupportTeamId = visibleTeams.length ? String(visibleTeams[0].id || "") : "";
  }
  const activeTeam = teams.find((team) => String(team.id) === activeSupportTeamId) || null;

  grid.innerHTML = visibleTeams
    .map(
      (team) => `
      <button type="button" class="team-card support-team-card ${
        String(team.id) === activeSupportTeamId ? "active" : ""
      }" data-support-team-id="${escapeHtml(team.id)}">
        <div class="support-team-top">
          <span class="support-team-badge ${escapeHtml(team.badgeClass)}">${escapeHtml(team.badge)}</span>
        </div>
        <h4>${escapeHtml(team.name)}</h4>
        <p>${escapeHtml(team.members)} members</p>
        <small>${escapeHtml(team.activeTickets)} active tickets</small>
      </button>
    `
    )
    .join("");

  if (!activeTeam) return;

  detail.innerHTML = `
    <article class="team-card staff-detail-card team-lead-card">
      <div class="team-detail-head">
        <div class="team-detail-profile">
          <span class="team-detail-avatar">${escapeHtml(activeTeam.lead?.split(" ").map((p) => p[0]).join("").slice(0, 2) || "NA")}</span>
          <div>
            <h4>${escapeHtml(activeTeam.lead)}</h4>
            <p class="team-role-chip">${escapeHtml(activeTeam.leadRole)}</p>
            <p class="sub">${escapeHtml(activeTeam.email)} · ${escapeHtml(activeTeam.phone)}</p>
          </div>
        </div>
      </div>
      <div class="team-detail-stats">
        <div class="team-metric"><span>Active Tickets</span><strong>${escapeHtml(activeTeam.stats.active)}</strong></div>
        <div class="team-metric"><span>Resolved</span><strong>${escapeHtml(activeTeam.stats.resolved)}</strong></div>
        <div class="team-metric"><span>Avg Time</span><strong>${escapeHtml(activeTeam.stats.avgTime)}</strong></div>
        <div class="team-metric"><span>Satisfaction</span><strong>${escapeHtml(activeTeam.stats.satisfaction)}</strong></div>
      </div>
    </article>
  `;

  if (subtitle) subtitle.textContent = `${activeTeam.name} team members and group settings.`;

  const staffMembers = Array.isArray(activeTeam.staffMembers) ? activeTeam.staffMembers : [];
  staffCards.innerHTML = staffMembers
    .map(
      (staff) => `
      <article class="team-card staff-detail-card">
        <div class="team-detail-head">
          <div class="team-detail-profile">
            <span class="team-detail-avatar">${escapeHtml(staff.name?.split(" ").map((p) => p[0]).join("").slice(0, 2) || "NA")}</span>
            <div>
              <h4>${escapeHtml(staff.name)}</h4>
              <p class="team-role-chip">${escapeHtml(staff.role)}</p>
              <p class="sub">${escapeHtml(staff.email)} · ${escapeHtml(staff.phone)}</p>
            </div>
          </div>
        </div>
        <div class="team-detail-stats">
          <div class="team-metric"><span>Active Tickets</span><strong>${escapeHtml(staff.activeTickets)}</strong></div>
        </div>
      </article>
    `
    )
    .join("");

  const localRequests = loadLocalAccessRequests();
  const baseRequests = Array.isArray(data?.accessRequests) ? data.accessRequests : [];
  const mergedRequests = [...localRequests, ...baseRequests].reduce((acc, item) => {
    const key = `${String(item.id || "")}|${String(item.email || "").toLowerCase()}|${String(item.role || "").toLowerCase()}`;
    if (!acc.some((existing) => `${String(existing.id || "")}|${String(existing.email || "").toLowerCase()}|${String(existing.role || "").toLowerCase()}` === key)) {
      acc.push(item);
    }
    return acc;
  }, []);
  const requests = mergedRequests.filter((req) => {
    const role = String(req.role || "").toLowerCase();
    return role === "staff" || role === "admin";
  });
  const filtered = requests.filter((req) => {
    if (activeSupportTab === "permissions") {
      return supportRequestFilterValue === "all" ? true : String(req.status) === supportRequestFilterValue;
    }
    const sameTeam = String(req.teamId || "") === String(activeTeam.id || "");
    if (!sameTeam) return false;
    return supportRequestFilterValue === "all" ? true : String(req.status) === supportRequestFilterValue;
  });
  accessBody.innerHTML = filtered
    .map(
      (req) => `
      <tr>
        <td><strong>${escapeHtml(req.requester)}</strong><div class="sub">${escapeHtml(req.email)}</div></td>
        <td>${escapeHtml(req.department)}</td>
        <td><span class="role-pill">${escapeHtml(req.role)}</span></td>
        <td><span class="status-pill ${escapeHtml(req.status)}">${escapeHtml(req.status)}</span></td>
        <td>${escapeHtml(req.date)}</td>
        <td class="request-actions">
          ${
            activeSupportTab === "permissions" && String(req.status) === "pending"
              ? (() => {
                  const role = String(req.role || "").toLowerCase();
                  const canReview = role !== "admin" || isSystemAdminSession(session);
                  if (!canReview) return `<span class="sub">System admin approval required</span>`;
                  return `<button type="button" class="link-btn approve" data-request-action="approve" data-request-id="${escapeHtml(req.id || "")}" data-request-email="${escapeHtml(req.email || "")}" data-request-role="${escapeHtml(req.role || "")}">Approve</button><button type="button" class="link-btn reject" data-request-action="reject" data-request-id="${escapeHtml(req.id || "")}" data-request-email="${escapeHtml(req.email || "")}" data-request-role="${escapeHtml(req.role || "")}">Reject</button>`;
                })()
              : `<span class="sub">${escapeHtml(req.reviewedBy ? `Reviewed by ${req.reviewedBy}` : "No actions")}</span>`
          }
        </td>
      </tr>
    `
    )
    .join("");

  if (requestFilter) requestFilter.value = supportRequestFilterValue;

  const showGroupsOverview = activeSupportTab === "groups";
  addTeamButton?.classList.toggle("hidden", !showGroupsOverview);
  searchRow?.classList.toggle("hidden", !showGroupsOverview);
  grid.classList.toggle("hidden", !showGroupsOverview);
  groupsPanel.classList.toggle("hidden", activeSupportTab !== "groups");
  accessPanel.classList.toggle("hidden", activeSupportTab !== "permissions");
  document.querySelectorAll(".support-tab[data-support-tab]").forEach((tab) => {
    const tabValue = String(tab.getAttribute("data-support-tab") || "");
    tab.classList.toggle("active", tabValue === activeSupportTab);
  });
}

async function applyTicketChanges(ticket, nextStatus, nextPriority, nextTeam, triggerButton = null, suppressToast = false) {
  const prevStatus = ticket.status;
  const prevPriority = ticket.priority;
  const prevTeam = ticket.assignedTeam;
  ticket.status = nextStatus || ticket.status;
  ticket.priority = nextPriority || ticket.priority;
  ticket.assignedTeam = nextTeam || ticket.assignedTeam;
  ticket.updated_at = new Date().toISOString();
  recalculateOverviewMetrics();
  syncOverviewRowControls(ticket);
  if (activeOverviewModalTicketId === ticket.ticketId) renderTicketDetails(ticket);
  if (triggerButton instanceof HTMLButtonElement) {
    triggerButton.disabled = true;
    triggerButton.textContent = "Updating...";
  }
  const ok = await persistOverviewTicketUpdate(ticket);
  const changes = [];
  if (prevStatus !== ticket.status) changes.push(`Status: ${prevStatus} -> ${ticket.status}`);
  if (prevPriority !== ticket.priority) changes.push(`Priority: ${prevPriority} -> ${ticket.priority}`);
  if (prevTeam !== ticket.assignedTeam) changes.push(`Team: ${prevTeam} -> ${ticket.assignedTeam}`);
  const detail = changes.length ? `${ticket.ticketId} | ${changes.join(" | ")}` : `${ticket.ticketId} | No field changes`;
  if (!suppressToast) {
    showUpdateToast({
      title: ok ? "Ticket updated" : "Saved locally",
      detail,
      tone: ok ? "success" : "warning",
    });
  }
  if (triggerButton instanceof HTMLButtonElement) {
    triggerButton.disabled = false;
    triggerButton.textContent = "Update";
  }
}

async function loadAdminData() {
  const ticketsData = await fetchJsonOrFallback("/api/tickets", null);
  const tickets = Array.isArray(ticketsData?.tickets)
    ? ticketsData.tickets.map(normalizeAdminTicket)
    : [];
  allTicketsState = tickets;
  overviewTicketsState = getOverviewTicketsByRange();
  renderOverview(computeOverviewDataFromTickets(overviewTicketsState));
  renderManageTickets(allTicketsState);
  const openCount = allTicketsState.filter((ticket) => ticket.status === "Open").length;
  const resolvedCount = allTicketsState.filter((ticket) => ticket.status === "Resolved").length;
  renderAnalytics({
    summary: {
      new: openCount,
      complete: resolvedCount,
      staff: 0,
      users: 0,
      tickets: allTicketsState.length,
    },
    cards: [
      {
        title: "Live ticket data",
        copy: `${allTicketsState.length} ticket(s) loaded from the backend ticket API.`,
      },
    ],
  });
  renderSupportTeams({ teams: [], accessRequests: [] });
  if (!ticketsData) {
    showUpdateToast({
      title: "Admin API unavailable",
      detail: lastAdminApiError || "Could not load /api/tickets from the backend.",
      tone: "warning",
    });
  }
}

function activateAdminPage(pageId) {
  const safePageId = pages.some((page) => page.id === pageId) ? pageId : "overview";
  pages.forEach((page) => {
    page.classList.toggle("active", page.id === safePageId);
  });
  pageLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.pageLink === safePageId);
  });
}

pageLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const pageId = String(link.dataset.pageLink || "overview");
    activateAdminPage(pageId);
    window.history.replaceState(null, "", `#${pageId}`);
  });
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const teamBtn = target.closest("[data-support-team-id]");
  if (teamBtn instanceof HTMLElement) {
    activeSupportTeamId = String(teamBtn.dataset.supportTeamId || "");
    renderSupportTeams(supportTeamsState || mockAdminData.supportTeams);
    const targetPage = activeSupportTab === "permissions" ? "support-teams" : "support-team-detail";
    activateAdminPage(targetPage);
    window.history.replaceState(null, "", `#${targetPage}`);
  }
});

const supportRequestFilter = document.getElementById("supportRequestFilter");
supportRequestFilter?.addEventListener("change", () => {
  supportRequestFilterValue = String(supportRequestFilter.value || "all");
  renderSupportTeams(supportTeamsState || mockAdminData.supportTeams);
});

const supportAccessBody = document.getElementById("supportAccessBody");
supportAccessBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const action = String(target.dataset.requestAction || "");
  if (!["approve", "reject"].includes(action)) return;
  const requestId = String(target.dataset.requestId || "");
  const requestEmail = String(target.dataset.requestEmail || "").toLowerCase();
  const requestRole = String(target.dataset.requestRole || "").toLowerCase();
  if (!requestEmail || !requestRole) return;
  if (requestRole === "admin" && !isSystemAdminSession(session)) {
    showUpdateToast({
      title: "Action blocked",
      detail: "Only system admin can approve or reject admin requests.",
      tone: "warning",
    });
    return;
  }

  const nextStatus = action === "approve" ? "approved" : "rejected";
  const reviewer = session?.email || "Admin";
  const currentState = supportTeamsState || mockAdminData.supportTeams;
  const matchedRequest = (Array.isArray(currentState?.accessRequests) ? currentState.accessRequests : []).find((req) => {
    const sameId = requestId && String(req.id || "") === requestId;
    const sameIdentity =
      String(req.email || "").toLowerCase() === requestEmail && String(req.role || "").toLowerCase() === requestRole;
    return sameId || sameIdentity;
  });
  const nextAccess = (Array.isArray(currentState?.accessRequests) ? currentState.accessRequests : []).map((req) => {
    const sameId = requestId && String(req.id || "") === requestId;
    const sameIdentity =
      String(req.email || "").toLowerCase() === requestEmail && String(req.role || "").toLowerCase() === requestRole;
    if (!sameId && !sameIdentity) return req;
    return { ...req, status: nextStatus, reviewedBy: reviewer };
  });
  let nextTeams = Array.isArray(currentState?.teams) ? [...currentState.teams] : [];
  let resolvedTeamId = String(matchedRequest?.teamId || "");
  if (nextStatus === "approved") {
    const requestDepartment = String(matchedRequest?.department || "").trim();
    let teamIndex = -1;
    if (resolvedTeamId) {
      teamIndex = nextTeams.findIndex((team) => String(team.id || "") === resolvedTeamId);
    }
    if (teamIndex < 0 && requestDepartment) {
      teamIndex = nextTeams.findIndex(
        (team) => String(team.name || "").trim().toLowerCase() === requestDepartment.toLowerCase()
      );
    }
    if (teamIndex < 0) {
      const newDepartmentName = requestDepartment || "General Department";
      const fallbackName = requestEmail.split("@")[0];
      const newTeam = createSupportTeamRecord(
        {
          name: newDepartmentName,
          lead: String(matchedRequest?.requester || fallbackName),
          email: requestEmail,
        },
        nextTeams
      );
      newTeam.leadRole = requestRole === "admin" ? "Admin" : "Support Staff";
      if (Array.isArray(newTeam.staffMembers) && newTeam.staffMembers.length) {
        newTeam.staffMembers[0] = {
          ...newTeam.staffMembers[0],
          role: requestRole === "admin" ? "Admin" : "Support Staff",
        };
      }
      nextTeams.push(newTeam);
      teamIndex = nextTeams.length - 1;
      resolvedTeamId = String(newTeam.id || "");
      activeSupportTeamId = resolvedTeamId;
    }
    if (teamIndex >= 0) {
      const team = nextTeams[teamIndex];
      resolvedTeamId = String(team.id || resolvedTeamId);
      const staffMembers = Array.isArray(team.staffMembers) ? [...team.staffMembers] : [];
      const alreadyInTeam = staffMembers.some((staff) => String(staff.email || "").toLowerCase() === requestEmail);
      if (!alreadyInTeam) {
        const fallbackName = requestEmail.split("@")[0];
        const roleLabel = requestRole === "admin" ? "Admin" : "Support Staff";
        staffMembers.push({
          name: String(matchedRequest?.requester || fallbackName),
          role: roleLabel,
          email: requestEmail,
          phone: "-",
          activeTickets: 0,
        });
      }
      nextTeams[teamIndex] = {
        ...team,
        staffMembers,
        members: staffMembers.length,
      };
    }
  }
  const nextAccessWithTeam = nextAccess.map((req) => {
    const sameId = requestId && String(req.id || "") === requestId;
    const sameIdentity =
      String(req.email || "").toLowerCase() === requestEmail && String(req.role || "").toLowerCase() === requestRole;
    if (!sameId && !sameIdentity) return req;
    return resolvedTeamId ? { ...req, teamId: resolvedTeamId } : req;
  });
  supportTeamsState = { ...currentState, accessRequests: nextAccessWithTeam, teams: nextTeams };

  const localRequests = loadLocalAccessRequests().map((req) => {
    const sameId = requestId && String(req.id || "") === requestId;
    const sameIdentity =
      String(req.email || "").toLowerCase() === requestEmail && String(req.role || "").toLowerCase() === requestRole;
    if (!sameId && !sameIdentity) return req;
    return {
      ...req,
      status: nextStatus,
      reviewedBy: reviewer,
      ...(resolvedTeamId ? { teamId: resolvedTeamId } : {}),
    };
  });
  saveLocalAccessRequests(localRequests);

  const accounts = loadLocalAccounts().map((acc) => {
    const same = String(acc.email || "").toLowerCase() === requestEmail && String(acc.role || "").toLowerCase() === requestRole;
    if (!same) return acc;
    return {
      ...acc,
      approvalStatus: nextStatus === "approved" ? "approved" : "rejected",
      updated_at: new Date().toISOString(),
    };
  });
  saveLocalAccounts(accounts);

  const persisted = await persistAccessRequestDecision({
    requestId,
    status: nextStatus,
    reviewedBy: reviewer,
  });
  showUpdateToast({
    title: persisted
      ? nextStatus === "approved"
        ? "Access approved"
        : "Access rejected"
      : "Access updated locally",
    detail: `${requestEmail} (${requestRole})`,
    tone: persisted && nextStatus === "approved" ? "success" : "warning",
  });
  renderSupportTeams(supportTeamsState);
});

const supportTeamSearch = document.getElementById("supportTeamSearch");
supportTeamSearch?.addEventListener("input", () => {
  renderSupportTeams(supportTeamsState || mockAdminData.supportTeams);
});

const addTeamBtn = document.getElementById("addTeamBtn");
addTeamBtn?.addEventListener("click", () => {
  resetAddTeamErrors();
  addTeamForm?.reset();
  openAddTeamModal();
});

addTeamForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const payload = {
    name: String(addTeamNameInput?.value || "").trim(),
    lead: String(addTeamLeadInput?.value || "").trim(),
    email: String(addTeamLeadEmailInput?.value || "").trim(),
  };
  void handleAddSupportTeam(payload);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.closeAddTeamModal === "true") closeAddTeamModal();
});

const addStaffInTeamBtn = document.getElementById("addStaffInTeamBtn");
addStaffInTeamBtn?.addEventListener("click", () => {
  const currentState = supportTeamsState || mockAdminData.supportTeams;
  const teams = Array.isArray(currentState?.teams) ? currentState.teams : [];
  const activeTeam = teams.find((team) => String(team.id) === String(activeSupportTeamId));
  if (!activeTeam) {
    showUpdateToast({ title: "No team selected", detail: "Select a team before adding a staff member.", tone: "warning" });
    return;
  }
  openAddStaffModal(String(activeTeam.name || ""));
});

addStaffForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  void handleAddStaffInTeamSubmit();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.closeAddStaffModal === "true") closeAddStaffModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAddStaffModal();
});

document.querySelectorAll(".support-tab[data-support-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    activeSupportTab = String(tab.getAttribute("data-support-tab") || "groups");
    activateAdminPage("support-teams");
    window.history.replaceState(null, "", "#support-teams");
    renderSupportTeams(supportTeamsState || mockAdminData.supportTeams);
  });
});

const backToTeamsBtn = document.getElementById("backToTeamsBtn");
backToTeamsBtn?.addEventListener("click", () => {
  activateAdminPage("support-teams");
  window.history.replaceState(null, "", "#support-teams");
});

const initialHashPage = window.location.hash.replace("#", "");
activateAdminPage(initialHashPage || "overview");

rangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const selectedRange = String(button.dataset.range || "today");
    activeRange = selectedRange;
    rangeButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.range === selectedRange);
    });
    refreshOverviewForActiveRange();
  });
});

loadAdminData();
bindOverviewInteractions();
