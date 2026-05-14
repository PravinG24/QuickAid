# QuickAid Frontend (Phase 2 + 3)

Frontend implementation for:
- UI wireframe/mockup translated into working interface
- Ticket submission form (HTML/CSS/JS)
- Client-side form validation
- Track ticket by email
- Guided intake UX (templates, knowledge suggestions, SLA hint)
- Draft auto-save and recovery
- Attachment validation (client-side)
- Ticket detail modal with timeline
- Separate Login/Register pages with role-based onboarding
- Role-based UI design themes (user, admin, staff)
- SLA due label with auto-refresh
- Azure App Service static hosting ready

## Files

- `index.html`: public information/home page
- `dashboard.html`: signed-in user ticket workspace and form screens
- `login.html`: dedicated login page
- `register.html`: dedicated registration page
- `style.css`: responsive styling and states
- `app.js`: validation, API calls, submit/track logic
- `auth.css`: auth page styling
- `auth.js`: login/register page logic and session persistence
- `web.config`: Azure App Service static hosting settings (Windows)

## Updated Plan

- Move authentication from modal to standalone pages for clearer flow.
- Keep notifications at the top-right of the app shell for quick access.
- Provide three visual variants by role:
  - `user`: primary blue support workspace
  - `admin`: amber/orange operations workspace
  - `staff`: green service workspace
- Apply role theme from session after login/register.

## Run Locally

Open `index.html` in browser, or serve this folder with any static server.

Route flow:
- `index.html` home page
- `login.html` / `register.html` authentication
- `dashboard.html` user ticket workspace
- `admin.html` administrator console

By default, app runs in backend-first mode against local Azure Functions:
- `http://localhost:7071`
- demo/mock ticket creation is disabled
- frontend-only features without backend routes are commented out or disabled

## Connect Real Backend

Set global config before page scripts to use a deployed backend:

```html
<script>
  window.QUICKAID_API_BASE = "https://<your-function-app>.azurewebsites.net";
</script>
```

For same-origin hosting where the frontend and Azure Functions app share one domain, set an explicit empty base before the page scripts:

```html
<script>
  window.QUICKAID_API_BASE = "";
</script>
```

Currently supported endpoints:
- `POST /api/submit_ticket`
- `GET /api/get_ticket?email={email}`
- `POST /api/register_user`
- `POST /api/user_login`
- `POST /api/register_admin`
- `POST /api/admin_login`
- `GET /api/tickets`
- `PATCH /api/tickets_update/{ticketId}`

Disabled until backend routes exist:
- `GET /api/admin/overview?range={today|week|month|year}`
- `GET|POST /api/admin/support_teams`
- `POST /api/admin/support_teams/{teamId}/staff`
- `GET /api/admin/analytics`
- `PATCH /api/admin/access_requests/{requestId}`

## Validation Rules Implemented

- Required: name, email, category, subject, description
- Required: request type and consent checkbox
- Email format check
- Subject max 120 chars
- Description max 2000 chars
- Basic unsafe character guard (`<` and `>`)
- Attachment max size: 5 MB, limited file extensions
- Prevent duplicate submit while request is pending

## UX Enhancements Implemented

- Placeholder + helper text for every major field
- Quick templates (`Wi-Fi`, `Aircond`, `Portal login`) to reduce submission friction
- Suggested self-help articles based on subject keywords
- Admin-owned priority assignment with requester-side priority display/filtering
- Track tickets with status filter and sort options
- Draft autosave in `localStorage` and restore on reload

## Azure App Service Deployment (Static Files)

1. Create Azure App Service (Windows, Free Tier).
2. Deploy files in `frontend/` to `wwwroot` (Zip Deploy or VS Code extension).
3. Verify `index.html` is default page.
4. Set backend URL script in `dashboard.html`, `login.html`, `register.html`, and `admin.html` if using real backend.
5. Test:
   - submit valid ticket
   - submit invalid ticket and confirm validation errors
   - track tickets by email

## Suggested Screenshot Checklist

- Submit Ticket page
- Validation error state
- Success state showing ticket ID
- Track Tickets results list
- Live App Service URL in browser bar
