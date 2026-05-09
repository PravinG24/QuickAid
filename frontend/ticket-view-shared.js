function quickAidEscapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function quickAidFormatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function quickAidPriorityClass(priority) {
  const value = String(priority || "").toLowerCase();
  if (value === "high" || value === "urgent") return "priority-high";
  if (value === "low") return "priority-low";
  return "priority-medium";
}

function quickAidBadgeClass(status) {
  const value = String(status || "").toLowerCase().replaceAll(" ", "");
  if (value === "resolved" || value === "closed") return "badge-resolved";
  if (value === "inprogress") return "badge-inprogress";
  return "badge-new";
}

function quickAidRenderComments(items) {
  const comments = Array.isArray(items) ? items : [];
  if (!comments.length) return '<li class="ticket-shared-muted">No comments yet.</li>';
  return comments
    .map(
      (comment) => `
        <li class="comment-bubble">
          <div class="comment-head">
            <strong>${quickAidEscapeHtml(comment.by || "Support")}</strong>
            <span class="ticket-shared-muted">${quickAidEscapeHtml(quickAidFormatDateTime(comment.at))}</span>
          </div>
          <div class="comment-body">${quickAidEscapeHtml(comment.text || "")}</div>
        </li>
      `
    )
    .join("");
}

function quickAidRenderTimeline(items) {
  const timeline = Array.isArray(items) ? items : [];
  if (!timeline.length) return '<li class="ticket-shared-muted">No activity yet.</li>';
  return timeline
    .map(
      (entry) => `
        <li class="timeline-item activity-item">
          <div class="timeline-dot"></div>
          <div class="timeline-body">
            <strong>${quickAidEscapeHtml(entry.label || "Event")}</strong>
            <div class="ticket-shared-muted">${quickAidEscapeHtml(entry.by || "System")} • ${quickAidEscapeHtml(
        quickAidFormatDateTime(entry.at)
      )}</div>
          </div>
        </li>
      `
    )
    .join("");
}

function quickAidRenderTicketDetailLayout(ticket, options = {}) {
  const safeTicket = ticket || {};
  const comments = Array.isArray(safeTicket.comments) ? safeTicket.comments : [];
  const timeline = Array.isArray(safeTicket.timeline) ? safeTicket.timeline : [];
  const extraSectionHtml = String(options.extraSectionHtml || "");
  return `
    <header class="ticket-page-head">
      <div class="ticket-page-title-wrap">
        <h1>Ticket #${quickAidEscapeHtml(safeTicket.ticketId || safeTicket.ticket_id || "N/A")}</h1>
        <p class="muted">${quickAidEscapeHtml(safeTicket.issue || safeTicket.subject || "Ticket subject")}</p>
      </div>
      <div class="ticket-page-badges">
        <span class="badge ${quickAidBadgeClass(safeTicket.status)}">${quickAidEscapeHtml(safeTicket.status || "Open")}</span>
        <span class="detail-priority-pill ${quickAidPriorityClass(safeTicket.priority)}">${quickAidEscapeHtml(
    safeTicket.priority || "Medium"
  )}</span>
      </div>
    </header>
    <section class="ticket-page-grid">
      <article class="detail-block">
        <h3>Ticket Details</h3>
        <div class="ticket-section">
          <h4>Subject</h4>
          <p class="muted">${quickAidEscapeHtml(safeTicket.issue || safeTicket.subject || "No subject")}</p>
        </div>
        <div class="ticket-section">
          <h4>Description</h4>
          <p class="detail-description muted">${quickAidEscapeHtml(
            safeTicket.description || safeTicket.issue || "No additional description provided."
          )}</p>
        </div>
      </article>
      <aside class="detail-block">
        <h3>Ticket Information</h3>
        <div class="info-row">
          <span class="info-key">Submitted by</span>
          <span class="info-val">${quickAidEscapeHtml(safeTicket.user || safeTicket.name || "Requester")}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Department</span>
          <span class="info-val">${quickAidEscapeHtml(safeTicket.category || safeTicket.department || "General")}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Assigned to</span>
          <span class="info-val">${quickAidEscapeHtml(
            safeTicket.assignedTeam || safeTicket.assignedTo || safeTicket.assigned_to || "Unassigned"
          )}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Created</span>
          <span class="info-val">${quickAidEscapeHtml(
            quickAidFormatDateTime(safeTicket.created_at || safeTicket.submitted_at || safeTicket.updated_at)
          )}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Last Updated</span>
          <span class="info-val">${quickAidEscapeHtml(quickAidFormatDateTime(safeTicket.updated_at))}</span>
        </div>
      </aside>
    </section>
    <section class="detail-block">
      <h3>Comments (${comments.length})</h3>
      <p class="muted">Conversation and updates from team members</p>
      <ul class="comment-list">${quickAidRenderComments(comments)}</ul>
    </section>
    <section class="detail-block">
      <h3>Activity Log</h3>
      <ul class="timeline-list activity-log">${quickAidRenderTimeline(timeline)}</ul>
    </section>
    ${extraSectionHtml}
  `;
}

window.QuickAidTicketView = {
  escapeHtml: quickAidEscapeHtml,
  formatDateTime: quickAidFormatDateTime,
  priorityClass: quickAidPriorityClass,
  badgeClass: quickAidBadgeClass,
  renderComments: quickAidRenderComments,
  renderTimeline: quickAidRenderTimeline,
  renderTicketDetailLayout: quickAidRenderTicketDetailLayout,
};
