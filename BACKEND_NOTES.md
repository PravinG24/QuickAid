# QuickAid Backend Handoff Notes

This document summarizes what the frontend already uses, what backend functions already exist, and what is still needed so disabled frontend features can be enabled safely.

## Current Working Backend Routes

These routes exist in `backend/` and are used by the frontend.

- [ ] `POST /api/register_user`
  - Request: `{ "name": string, "email": string, "password": string }`
  - Response expected by frontend: `{ "userId": string, "name": string, "email": string, "role": "user" }`

- [ ] `POST /api/user_login`
  - Request: `{ "email": string, "password": string }`
  - Response expected by frontend: `{ "userId": string, "name": string, "email": string, "role": "user" }`

- [ ] `POST /api/register_admin`
  - Request: `{ "name": string, "email": string, "password": string }`
  - Response expected by frontend: `{ "adminId": string, "name": string, "email": string, "role": "admin" }`
  - Backend route currently uses `authLevel: "function"`, so frontend must send `x-functions-key` or backend must switch to another auth approach.
  - For Entra testing, `ENTRA_BOOTSTRAP_ADMIN_EMAIL` is auto-approved by `shared/admin_auth.py`.

- [ ] `POST /api/login/admin`
  - Request: `{ "email": string, "password": string }`
  - Response expected by frontend: `{ "adminId": string, "name": string, "email": string, "role": "admin" }`
  - Backend route currently uses `authLevel: "function"`, so frontend must send `x-functions-key` or backend must switch to another auth approach.
  - Important: route is `/api/login/admin`, not `/api/admin_login`.

- [ ] `POST /api/submit_ticket`
  - Frontend currently sends only backend-supported fields:
    ```json
    {
      "email": "student@campus.edu",
      "title": "Brief issue title",
      "description": "Issue details",
      "category": "IT"
    }
    ```
  - Allowed category values currently used by backend: `IT`, `HR`, `Finance`, `Operations`, `General`.

- [ ] `GET /api/get_ticket?email={email}&status={status}&category={category}`
  - Used to load a user's ticket list, with optional `status` and `category` filters.
  - Expected response:
    ```json
    {
      "email": "student@campus.edu",
      "totalCount": 1,
      "tickets": []
    }
    ```

## Important Current Gaps In Existing Routes

- [ ] Store the full ticket fields the frontend captures:
  - `name` or requester display name
  - `priority`: `High`, `Medium`, `Low`
  - `location`
  - `department` or `assignedTeam`
  - `assigned_to` / owner
  - attachment metadata
  - ticket timeline / status history

- [ ] Return a canonical ticket shape from all ticket routes:
  ```json
  {
    "ticketId": "TCKT-01",
    "type": "ticket",
    "email": "student@campus.edu",
    "requesterName": "Student Name",
    "title": "Issue title",
    "description": "Issue details",
    "category": "IT",
    "priority": "Medium",
    "status": "Open",
    "assignedTeam": "IT Services",
    "location": "Library Level 2",
    "createdAt": "2026-05-13T00:00:00Z",
    "updatedAt": "2026-05-13T00:00:00Z"
  }
  ```

- [ ] Decide final auth model:
  - Keep Azure Function keys for admin register/login and make frontend send `x-functions-key`, or
  - Change admin auth endpoints to anonymous for demo, or
  - Implement proper session/JWT/Entra ID auth.

- [ ] Configure Azure Function App CORS for the deployed frontend origin:
  - Example: `https://quickaid-frontend-....azurewebsites.net`

## Backend Status: Admin Dashboard

Admin ticket data should use the `/api/admin/*` routes. Do not use
`/api/get_ticket?email={email}` for the admin dashboard because that route is
requester-scoped and only returns tickets for one email address.

- [x] `GET /api/admin/overview?range={today|week|month|year}`
  - Purpose: dashboard KPIs, category distribution, priority distribution, trend chart, recent tickets.
  - Suggested response:
    ```json
    {
      "metrics": {
        "totalTickets": 0,
        "open": 0,
        "inProgress": 0,
        "resolved": 0
      },
      "overviewKpis": {
        "avgResolutionTime": "0h",
        "slaResponseRate": 0
      },
      "categoryDistribution": [
        { "label": "IT", "value": 0 }
      ],
      "priorityDistribution": [
        { "label": "High", "percent": 0, "className": "high" },
        { "label": "Medium", "percent": 0, "className": "medium" },
        { "label": "Low", "percent": 0, "className": "low" }
      ],
      "weeklyTrend": {
        "created": [0, 0, 0, 0, 0, 0, 0],
        "resolved": [0, 0, 0, 0, 0, 0, 0]
      },
      "tickets": []
    }
    ```

- [x] `GET /api/admin/tickets`
  - Purpose: admin manage tickets table.
  - Suggested response:
    ```json
    {
      "tickets": [
        {
          "ticketId": "TCKT-01",
          "user": "Student Name",
          "email": "student@campus.edu",
          "issue": "Issue title",
          "category": "IT",
          "priority": "Medium",
          "status": "Open",
          "assignedTeam": "IT Services",
          "created_at": "2026-05-13T00:00:00Z",
          "updated_at": "2026-05-13T00:00:00Z"
        }
      ]
    }
    ```

- [ ] `GET /api/admin/tickets/{ticketId}`
  - Purpose: ticket detail modal/page for admin.
  - Include requester contact, description, comments, attachments metadata, status history, SLA fields.

- [x] `PATCH /api/admin/tickets/{ticketId}/status`
  - Request: `{ "status": "Open|In Progress|Resolved|Closed" }`
  - Response: updated ticket object.

- [x] `PATCH /api/admin/tickets/{ticketId}/assignment`
  - Request: `{ "assignedTeam": "IT Services" }`
  - Response: updated ticket object.

- [ ] Optional bulk endpoint: `PATCH /api/admin/tickets/bulk`
  - Purpose: support frontend bulk edit later.
  - Request: `{ "ticketIds": ["TCKT-01"], "status": "Resolved", "assignedTeam": "IT Services" }`

## Backend TODO: Support Teams And Staff

Frontend has UI for support groups, team details, add team, and add staff, but these are disabled/commented until backend exists.

- [ ] `GET /api/admin/support_teams`
  - Purpose: list teams, staff members, metrics, and permission/access requests.
  - Suggested response:
    ```json
    {
      "teams": [
        {
          "id": "technical",
          "name": "IT Services",
          "badge": "I",
          "badgeClass": "blue",
          "members": 3,
          "activeTickets": 12,
          "lead": "Team Lead",
          "leadRole": "Support Staff",
          "email": "lead@campus.edu",
          "phone": "+60 ...",
          "permissions": 1,
          "stats": {
            "active": 12,
            "resolved": 30,
            "avgTime": "4h",
            "satisfaction": "95%"
          },
          "staffMembers": []
        }
      ],
      "accessRequests": []
    }
    ```

- [ ] `POST /api/admin/support_teams`
  - Purpose: create support team from Add Team modal.
  - Request should accept at least: `name`, `lead`, `email`.
  - Return `201` with created team object.
  - Return `409` for duplicate team name.

- [ ] `POST /api/admin/support_teams/{teamId}/staff`
  - Purpose: add staff member to a team.
  - Request:
    ```json
    {
      "name": "Staff Name",
      "role": "Support Staff",
      "email": "staff@campus.edu",
      "phone": "+60 ...",
      "activeTickets": 0
    }
    ```
  - Return updated team or created staff member.

- [ ] Optional full team management:
  - `PATCH /api/admin/support_teams/{teamId}`
  - `DELETE /api/admin/support_teams/{teamId}`
  - `PATCH /api/admin/support_teams/{teamId}/staff/{staffId}`
  - `DELETE /api/admin/support_teams/{teamId}/staff/{staffId}`

## Backend TODO: Access Requests And Staff Accounts

Frontend registration currently allows only user/admin backend registration. Staff registration is disabled until backend supports it.

- [ ] Decide staff account model:
  - Option A: store staff in same user container with `role: "staff"` and `approvalStatus`.
  - Option B: separate `staff` documents linked to teams.

- [ ] `POST /api/admin/access_requests`
  - Purpose: create staff/admin access request from registration flow if approval workflow is required.
  - Request:
    ```json
    {
      "name": "Staff Name",
      "email": "staff@campus.edu",
      "role": "Staff",
      "department": "IT Services"
    }
    ```

- [ ] `GET /api/admin/access_requests`
  - Purpose: list pending/approved/rejected requests in admin permissions tab.

- [ ] `PATCH /api/admin/access_requests/{requestId}`
  - Purpose: approve or reject request.
  - Request:
    ```json
    {
      "status": "approved",
      "reviewedBy": "admin@campus.edu"
    }
    ```
  - Response:
    ```json
    {
      "ok": true,
      "data": {
        "id": "AR-001",
        "status": "approved",
        "reviewedBy": "admin@campus.edu",
        "teamId": "technical",
        "email": "staff@campus.edu",
        "role": "Staff"
      }
    }
    ```

## Backend TODO: Analytics

- [ ] `GET /api/admin/analytics`
  - Purpose: analytics page cards and counters.
  - Suggested response:
    ```json
    {
      "summary": {
        "new": 0,
        "complete": 0,
        "staff": 0,
        "users": 0,
        "tickets": 0
      },
      "cards": [
        { "title": "SLA Response", "copy": "0% within target" }
      ]
    }
    ```

## Backend TODO: Attachments And File Storage

Frontend attachment upload UI exists but is disabled because backend does not store files yet.

- [ ] Add file upload support:
  - suggested endpoint: `POST /api/tickets/{ticketId}/attachments`
  - store file in Azure Blob Storage
  - store metadata on ticket:
    ```json
    {
      "name": "screenshot.png",
      "type": "image/png",
      "size": 12345,
      "url": "https://..."
    }
    ```

- [ ] Add attachment listing in ticket detail response.

- [ ] Add secure download URL strategy.

## Backend TODO: Comments And Timeline

Ticket detail page has add-comment UI disabled until backend has comment routes.

- [ ] `GET /api/tickets/{ticketId}/comments`
- [ ] `POST /api/tickets/{ticketId}/comments`
  - Request:
    ```json
    {
      "authorEmail": "user@campus.edu",
      "body": "Comment text"
    }
    ```

- [ ] Include status timeline/history:
  - created
  - assigned
  - status changed
  - comment added
  - resolved/closed

## Backend TODO: Knowledge Base

Knowledge Base page, suggestions, and article feedback are frontend-only/disabled.

- [ ] `GET /api/knowledge/articles`
- [ ] `GET /api/knowledge/articles?query={query}`
- [ ] `POST /api/knowledge/articles/{articleId}/feedback`
  - Request: `{ "vote": "helpful|not_helpful", "userEmail": "user@campus.edu" }`

## Backend TODO: Notifications And Profile Preferences

Notification dropdown and profile preferences are disabled until backend routes exist.

- [ ] `GET /api/notifications?email={email}`
- [ ] `PATCH /api/notifications/{notificationId}`
  - mark notification read/unread

- [ ] `GET /api/profile?email={email}`
- [ ] `PATCH /api/profile/preferences`
  - Request example:
    ```json
    {
      "email": "user@campus.edu",
      "notifEmail": true,
      "notifInApp": true
    }
    ```

## Backend TODO: Microsoft Entra ID

Microsoft Entra demo sign-in/register buttons are disabled. Admin test bypass is also disabled.

- [ ] Decide if Entra ID is required for production.
- [ ] If yes, implement token validation on backend.
- [ ] Add frontend login flow using real Microsoft identity, not local demo data.
- [ ] Map Entra users to QuickAid roles: `user`, `staff`, `admin`.

## Required Error Response Shape

Use a consistent error response so frontend can show useful messages:

```json
{
  "ok": false,
  "error": "Human-readable error message",
  "code": "VALIDATION_ERROR",
  "fields": {
    "email": "Email is already registered"
  }
}
```

For success responses, prefer:

```json
{
  "ok": true,
  "data": {}
}
```

Existing functions currently return direct objects. That is acceptable for the current frontend, but future admin routes should use a consistent wrapper if possible.

## Environment And Deployment Checklist

- [ ] Function App CORS allows frontend App Service origin.
- [ ] App settings exist:
  - `COSMOS_ENDPOINT`
  - `COSMOS_KEY` or Key Vault `CosmosPrimaryKey`
  - `COSMOS_DATABASE`
  - `COSMOS_CONTAINER`
  - `PASSWORD_SECRET` or Key Vault `PasswordPepper`
  - `SENDGRID_API_KEY` or Key Vault `SendGridApiKey`
  - `SENDGRID_FROM_EMAIL`
- [ ] If using function-level auth, frontend deployment config includes:
  - `window.QUICKAID_FUNCTION_KEY`
  - GitHub secret `AZURE_FUNCTION_KEY`
- [ ] Confirm route names in frontend docs:
  - admin login route must be `/api/login/admin`, not `/api/admin_login`.

## Priority Order For Backend Team

1. [ ] Fix auth/deployment basics: function key, CORS, Cosmos settings, password pepper.
2. [ ] Expand ticket schema and return canonical ticket fields.
3. [ ] Implement admin ticket list/detail/status/assignment APIs.
4. [ ] Implement support teams and staff APIs.
5. [ ] Implement access request and staff approval workflow.
6. [ ] Implement analytics endpoint.
7. [ ] Implement attachments/file storage.
8. [ ] Implement comments/timeline.
9. [ ] Implement notifications/profile preferences.
10. [ ] Implement Knowledge Base APIs.
11. [ ] Replace demo auth with Microsoft Entra ID if required.
