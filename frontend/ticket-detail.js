const ticketCacheStorageKey = "quickaid-ticket-cache-v1";
const sessionKey = "quickaid-session-v1";
let activeTicket = null;
const DEFAULT_API_BASE = "http://localhost:7071";
const API_BASE = Object.prototype.hasOwnProperty.call(window, "QUICKAID_API_BASE")
  ? window.QUICKAID_API_BASE
  : DEFAULT_API_BASE;
const sharedTicketView = window.QuickAidTicketView || {};
const escapeHtml = sharedTicketView.escapeHtml || ((value) => String(value || ""));
const formatDateTime = sharedTicketView.formatDateTime || ((value) => String(value || "-"));

function renderInlineFormatting(value) {
  return escapeHtml(value)
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

function renderDescriptionFormatting(value) {
  if (typeof sharedTicketView.renderDescriptionFormatting === "function") {
    return sharedTicketView.renderDescriptionFormatting(value);
  }

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

function statusBadgeClass(status) {
  if (!status) return "badge-new";
  return `badge-${String(status).toLowerCase()}`;
}

function prettyStatus(status) {
  if (status === "New") return "Open";
  if (status === "InProgress") return "In Progress";
  return status || "Open";
}

// modify from frontend: ticket detail can render current backend fields and cached frontend fields.
function normalizeDetailStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "open") return "New";
  if (value === "in progress" || value === "inprogress") return "InProgress";
  if (value === "resolved") return "Resolved";
  if (value === "closed") return "Closed";
  return status || "New";
}

function priorityClass(priority) {
  const fallback = String(priority || "Medium").toLowerCase();
  if (sharedTicketView.priorityClass) return sharedTicketView.priorityClass(priority);
  if (fallback === "low") return "priority-low";
  if (fallback === "high" || fallback === "urgent") return "priority-high";
  return "priority-medium";
}

function loadCachedTickets() {
  try {
    const raw = localStorage.getItem(ticketCacheStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeDetailTicket) : [];
  } catch {
    return [];
  }
}

function normalizeDetailTicket(source) {
  const item = source || {};
  const ticketId = item.ticket_id || item.ticketId || item.id || "";
  const createdAt = item.created_at || item.createdAt || item.submitted_at || item.updated_at || item.updatedAt || new Date().toISOString();
  const updatedAt = item.updated_at || item.updatedAt || item.created_at || item.createdAt || item.submitted_at || new Date().toISOString();
  return {
    ...item,
    ticket_id: ticketId,
    ticketId,
    subject: item.subject || item.title || "No subject",
    title: item.title || item.subject || "No subject",
    status: normalizeDetailStatus(item.status),
    created_at: createdAt,
    submitted_at: item.submitted_at || createdAt,
    updated_at: updatedAt,
    createdAt,
    updatedAt,
  };
}

function getTicketAttachments(ticket) {
  const existing = Array.isArray(ticket.attachments) ? ticket.attachments : [];
  const image = ticket.image;
  if (!image || !image.data || !image.mimetype) return existing;
  return [
    ...existing,
    {
      name: image.filename || "ticket-image",
      type: image.mimetype,
      size: Math.ceil((String(image.data || "").length * 3) / 4),
      data: image.data,
      isStoredImage: true,
    },
  ];
}

function getAttachmentDataUrl(file) {
  if (!file || !file.data || !file.type) return "";
  return `data:${String(file.type)};base64,${String(file.data)}`;
}

function getAttachmentBlobUrl(file) {
  if (!file || !file.data || !file.type) return "";
  const binary = atob(String(file.data));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: String(file.type) });
  return URL.createObjectURL(blob);
}

function getSafeAttachmentName(name, index) {
  const fallback = `attachment_${index + 1}`;
  return String(name || fallback).replace(/[\\/:*?"<>|]+/g, "_");
}

function viewAttachment(file) {
  const blobUrl = getAttachmentBlobUrl(file);
  if (!blobUrl) return;
  const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
  
  setTimeout(() => {
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      alert("Popup may have been blocked.");
    }
  }, 500);
  
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60 * 1000);
}

function downloadAttachment(file, index) {
  const blobUrl = getAttachmentBlobUrl(file);
  if (!blobUrl) return;
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = getSafeAttachmentName(file.name, index);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function saveCachedTickets(tickets) {
  localStorage.setItem(ticketCacheStorageKey, JSON.stringify(Array.isArray(tickets) ? tickets : []));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(sessionKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistActiveTicket() {
  if (!activeTicket) return;
  const tickets = loadCachedTickets();
  const activeId = String(activeTicket.ticket_id || activeTicket.ticketId || activeTicket.id || "");
  const nextTickets = tickets.map((item) =>
    String(item.ticket_id || item.ticketId || item.id || "") === activeId ? { ...normalizeDetailTicket(activeTicket) } : item
  );
  saveCachedTickets(nextTickets);
}

function getTicketIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("ticketId") || "";
}

function renderTicket(ticket) {
  const title = document.getElementById("pageTicketTitle");
  const subtitle = document.getElementById("pageTicketSubject");
  const statusBadge = document.getElementById("pageStatusBadge");
  const priorityBadge = document.getElementById("pagePriorityBadge");
  const subject = document.getElementById("pageSubject");
  const description = document.getElementById("pageDescription");
  const attachments = document.getElementById("pageAttachments");
  const attachmentTitle = document.getElementById("pageAttachmentTitle");
  const submittedBy = document.getElementById("pageSubmittedBy");
  const department = document.getElementById("pageDepartment");
  const assignedTo = document.getElementById("pageAssignedTo");
  const createdAt = document.getElementById("pageCreatedAt");
  const updatedAt = document.getElementById("pageUpdatedAt");
  const comments = document.getElementById("pageComments");
  const commentsTitle = document.getElementById("pageCommentsTitle");
  const timeline = document.getElementById("pageTimeline");

  const safeTicketId = ticket.ticket_id || "N/A";
  const safeSubject = ticket.subject || "No subject";
  const status = ticket.status || "New";
  const priority = ticket.priority || "Medium";

  title.textContent = `Ticket #${safeTicketId}`;
  subtitle.textContent = safeSubject;
  statusBadge.className = `badge ${statusBadgeClass(status)}`;
  statusBadge.textContent = prettyStatus(status);
  priorityBadge.className = `detail-priority-pill ${priorityClass(priority)}`;
  priorityBadge.textContent = priority;
  subject.textContent = safeSubject;
  description.innerHTML = renderDescriptionFormatting(ticket.description);
  submittedBy.textContent = ticket.name || "Requester";
  department.textContent = ticket.department || ticket.category || "General Inquiry";
  assignedTo.textContent = ticket.assignedTo || ticket.assigned_to || "Unassigned";
  createdAt.textContent = formatDateTime(ticket.created_at || ticket.submitted_at);
  updatedAt.textContent = formatDateTime(ticket.updated_at || ticket.submitted_at);

  const atts = getTicketAttachments(ticket);
  if (attachmentTitle) attachmentTitle.textContent = `Attachments (${atts.length})`;
  attachments.innerHTML = "";
  if (!atts.length) {
    const li = document.createElement("li");
    li.className = "attachment-item muted";
    li.textContent = "No attachments.";
    attachments.appendChild(li);
  } else {
    atts.forEach((file, idx) => {
      const li = document.createElement("li");
      li.className = "attachment-item";
      const sizeKb = Math.ceil(Number(file.size || 0) / 1024);
      const isImage = String(file.type || "").startsWith("image/");
      const dataUrl = getAttachmentDataUrl(file);
      const canOpenAttachment = Boolean(file.isStoredImage && dataUrl);
      const previewHtml =
        canOpenAttachment
          ? `<div class="attachment-item-preview"><img src="${escapeHtml(dataUrl)}" alt="${escapeHtml(
              file.name || `attachment_${idx + 1}`
            )}" /></div>`
          : `<div class="attachment-item-preview muted">${isImage ? "Image preview unavailable." : "File preview unavailable."}</div>`;
      li.innerHTML = `
        <div class="attachment-item-head">
          <div class="attachment-item-meta">
            <strong>${file.name || `attachment_${idx + 1}`}</strong>
            <span class="muted">${isImage ? "Image" : "File"} · ${sizeKb} KB</span>
          </div>
          <div class="attachment-item-actions">
            <button type="button" class="ghost" data-attachment-action="view" ${canOpenAttachment ? "" : "disabled"}>View</button>
            <button type="button" class="ghost" data-attachment-action="download" ${canOpenAttachment ? "" : "disabled"}>Download</button>
          </div>
        </div>
        ${previewHtml}
      `;
      const viewButton = li.querySelector('[data-attachment-action="view"]');
      const downloadButton = li.querySelector('[data-attachment-action="download"]');
      viewButton?.addEventListener("click", () => viewAttachment(file, idx));
      downloadButton?.addEventListener("click", () => downloadAttachment(file, idx));
      attachments.appendChild(li);
    });
  }

  const commentItems = Array.isArray(ticket.comments) ? ticket.comments : [];
  if (commentsTitle) commentsTitle.textContent = `Comments (${commentItems.length})`;
  comments.innerHTML = sharedTicketView.renderComments
    ? sharedTicketView.renderComments(commentItems)
    : '<li class="muted">No comments yet.</li>';

  const timelineItems = Array.isArray(ticket.timeline) ? ticket.timeline : [];
  const normalizedTimeline = timelineItems.map((entry) => ({
    ...entry,
    by:
      entry.by ||
      entry.actor ||
      (String(entry.label || "").toLowerCase().includes("created") ? ticket.name || "Requester" : "System"),
  }));
  timeline.innerHTML = sharedTicketView.renderTimeline
    ? sharedTicketView.renderTimeline(normalizedTimeline)
    : '<li class="muted">No timeline entries.</li>';
}

function bindAddComment() {
  // Backend-first mode: add-comment UI is disabled until backend has a comment route.
}

/* Extra frontend-only function disabled: add comment has no backend route yet.
function bindAddComment() {
  const form = document.getElementById("pageCommentForm");
  const input = document.getElementById("pageNewComment");
  const addButton = document.getElementById("pageAddCommentBtn");
  const feedback = document.getElementById("pageCommentFeedback");
  if (
    !(form instanceof HTMLFormElement) ||
    !(input instanceof HTMLTextAreaElement) ||
    !(addButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  const setFeedback = (message, isError = false) => {
    if (!(feedback instanceof HTMLElement)) return;
    feedback.textContent = message;
    feedback.style.color = isError ? "#a93345" : "";
  };

  const setPending = (isPending) => {
    addButton.disabled = isPending;
    addButton.textContent = isPending ? "Adding..." : "Add Comment";
  };

  const submitComment = () => {
    if (!activeTicket) {
      setFeedback("Unable to add comment because ticket details were not found.", true);
      return;
    }
    const text = input.value.trim();
    if (!text) {
      setFeedback("Please enter a comment before submitting.", true);
      input.focus();
      return;
    }
    const session = loadSession();
    const commenter = session?.name || session?.email || "You";
    const timestamp = new Date().toISOString();
    const nextComment = { by: commenter, text, at: timestamp };
    const nextTimeline = { label: "Comment added", by: commenter, at: timestamp };

    setPending(true);
    const existingComments = Array.isArray(activeTicket.comments) ? activeTicket.comments : [];
    const existingTimeline = Array.isArray(activeTicket.timeline) ? activeTicket.timeline : [];
    activeTicket.comments = [...existingComments, nextComment];
    activeTicket.timeline = [...existingTimeline, nextTimeline];
    activeTicket.updated_at = timestamp;
    persistActiveTicket();
    renderTicket(activeTicket);
    input.value = "";
    setFeedback("Comment added.");
    setPending(false);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitComment();
  });
  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      submitComment();
    }
  });
}
*/

function init() {
  document.getElementById("btnBackToList")?.addEventListener("click", () => {
    window.location.href = "./dashboard.html";
  });

  const ticketId = getTicketIdFromUrl();
  const tickets = loadCachedTickets();
  const ticket = tickets.find((t) => String(t.ticket_id || t.ticketId || t.id || "") === String(ticketId || ""));

  if (!ticket) {
    activeTicket = null;
    renderTicket({
      ticket_id: ticketId || "N/A",
      subject: "Ticket not found",
      description: "No matching cached ticket was found. Return to the ticket list and open preview again.",
      status: "New",
      priority: "Medium",
      comments: [],
      timeline: [],
      attachments: [],
    });
    const input = document.getElementById("pageNewComment");
    const addButton = document.getElementById("pageAddCommentBtn");
    const feedback = document.getElementById("pageCommentFeedback");
    if (input instanceof HTMLTextAreaElement) input.disabled = true;
    if (addButton instanceof HTMLButtonElement) addButton.disabled = true;
    if (feedback instanceof HTMLElement) feedback.textContent = "Comments are disabled for missing tickets.";
    bindAddComment();
    return;
  }

  activeTicket = normalizeDetailTicket(ticket);
  renderTicket(activeTicket);
  bindAddComment();
  // Bind delete button in ticket detail (single delete action placed here).
  const btnDelete = document.getElementById("btnDeleteTicket");
  if (btnDelete) {
    btnDelete.addEventListener("click", async () => {
      const session = loadSession();
      if (!session || !session.email) return alert("Sign in to delete tickets.");
      const ticketId = String(activeTicket?.ticket_id || activeTicket?.ticketId || "");
      if (!ticketId) return;
      if (!confirm(`Delete ticket ${ticketId}? This action cannot be undone.`)) return;
      try {
        btnDelete.disabled = true;
        const headers = {};
        const functionKey = String(window.QUICKAID_FUNCTION_KEY || "").trim();
        if (functionKey) headers["x-functions-key"] = functionKey;
        if (String(session.token || "").trim()) headers.Authorization = `Bearer ${session.token}`;
        const resp = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(ticketId)}`, {
          method: "DELETE",
          headers,
        });
        if (resp.ok) {
          window.location.href = "./dashboard.html";
        } else {
          const txt = await resp.text().catch(() => "");
          alert(`Delete failed: ${resp.status} ${txt}`);
        }
      } catch (err) {
        alert(`Delete failed: ${String(err?.message || err)}`);
      } finally {
        btnDelete.disabled = false;
      }
    });
  }
}

init();
