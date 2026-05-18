# Activity Log & Notification System Implementation

## Summary
This implementation adds:
1. **Activity Logging System** - Records all admin actions with proper actor identification
2. **User Notification System** - Notifies ticket creators when admins update their tickets

---

## Backend Changes

### 1. New File: `shared/activity_log.py`
**Purpose:** Centralized activity logging with actor identification

**Key Functions:**
- `create_activity_log()` - Records admin/user actions with timestamps
- `get_activity_log_for_ticket()` - Retrieve all actions on a specific ticket
- `get_activity_log_by_actor()` - Find all actions by a specific user/admin

**Log Entry Fields:**
- `actor` - Email of the person who performed the action
- `actor_type` - Either "admin" or "user"
- `action` - Type of action (e.g., "updated_ticket")
- `ticket_id` - Affected ticket ID
- `timestamp` - ISO format timestamp
- `updated_fields` - Dict of fields that changed
- `old_values` - Dict of previous values before update

**Example Activity Log Entry:**
```json
{
  "id": "LOG-1234567890-TCKT-01",
  "type": "activity_log",
  "actor": "admin@company.com",
  "actor_type": "admin",
  "action": "updated_ticket",
  "ticket_id": "TCKT-01",
  "timestamp": "2026-05-17T10:30:00.123456+00:00",
  "updated_fields": {
    "status": "In Progress",
    "priority": "High"
  },
  "old_values": {
    "status": "Open",
    "priority": "Medium"
  }
}
```

---

### 2. New File: `shared/notifications.py`
**Purpose:** User notification management when admins update tickets

**Key Functions:**
- `create_notification()` - Create notification for ticket creator
- `get_notifications_for_user()` - Retrieve notifications for a user
- `get_unread_notification_count()` - Count unread notifications
- `mark_notification_as_read()` - Mark single notification as read
- `mark_all_notifications_as_read()` - Mark all as read for a user

**Notification Fields:**
- `email` - Ticket creator's email (recipient)
- `ticket_id` - ID of the updated ticket
- `message` - Human-readable message
- `updated_fields` - Fields that were changed
- `timestamp` - When the notification was created
- `read` - Boolean flag (default: false)

**Example Notification:**
```json
{
  "id": "NOTIF-550e8400-e29b-41d4-a716-446655440000",
  "type": "notification",
  "email": "user@company.com",
  "ticket_id": "TCKT-01",
  "message": "Your ticket TCKT-01 has been updated: status to In Progress, priority to High",
  "updated_fields": {
    "status": "In Progress",
    "priority": "High"
  },
  "timestamp": "2026-05-17T10:30:00.123456+00:00",
  "read": false
}
```

---

### 3. Updated: `update_ticket/__init__.py`
**Changes:**
- Imports `create_activity_log` from `shared.activity_log`
- Imports `create_notification` from `shared.notifications`
- Extracts admin email from Entra token in payload
- Captures old values before applying updates
- Creates activity log entry with proper "admin" actor type
- Creates notification for ticket creator with updated field details
- Automatic notification message generation (e.g., "status to In Progress, priority to High")

**Trigger Conditions:**
- Only when admin updates ticket (admin-only endpoint)
- One update = one notification (+ one activity log entry)
- Notification fields tracked: status, priority, assignedTeam

---

### 4. New Function: `get_notifications`
**Route:** `GET /api/notifications`

**Parameters:**
- `email` (required) - User's email
- `unread_only` (optional) - Set to "true" to return only unread notifications

**Response:**
```json
{
  "email": "user@company.com",
  "notifications": [
    {
      "id": "NOTIF-...",
      "ticket_id": "TCKT-01",
      "message": "Your ticket TCKT-01 has been updated: status to In Progress",
      "timestamp": "2026-05-17T10:30:00.123456+00:00",
      "read": false,
      "updated_fields": {"status": "In Progress"}
    }
  ],
  "unread_count": 5,
  "total_count": 12
}
```

**Files:**
- `get_notifications/function.json` - Azure Functions config
- `get_notifications/__init__.py` - Implementation

---

### 5. New Function: `mark_notification_read`
**Route:** `PATCH /api/notifications/{notificationId}`

**Parameters:**
- `notificationId` - The notification ID (or "all" to mark all as read)
- When `notificationId="all"`, require `email` query parameter

**Example Requests:**
```bash
# Mark single notification
PATCH /api/notifications/NOTIF-550e8400-e29b-41d4-a716-446655440000

# Mark all as read
PATCH /api/notifications/all?email=user@company.com
```

**Response:**
```json
{
  "message": "Notification marked as read.",
  "notification": {
    "id": "NOTIF-...",
    "email": "user@company.com",
    "read": true
  }
}
```

**Files:**
- `mark_notification_read/function.json` - Azure Functions config
- `mark_notification_read/__init__.py` - Implementation

---

## Frontend Changes

### Updated: `frontend/app.js`
**Changes:**
- Replaced frontend-only mock notification system with backend API calls
- New async functions:
  - `fetchNotifications(email)` - Fetches notifications from backend
  - `renderNotifDropdown(email)` - Renders notifications from backend
  - `markNotificationAsRead(notificationId, email)` - Marks notification as read
  - `markAllNotifAsRead(email)` - Marks all as read
  
- Notification UI now:
  - Shows real notifications from backend
  - Displays proper timestamps
  - Updates unread count from backend
  - Marks notifications as read when clicked
  - Shows "Mark All Read" button functionality

**Behavior:**
- Notifications load automatically when user signs in
- Notifications panel fetches from backend on each open
- Clicking a notification marks it as read (backend updates)
- User can mark all notifications as read at once

---

## Data Flow

### When Admin Updates a Ticket:
```
1. Admin makes PATCH request to /api/update_ticket/{ticketId}
2. Admin auth verified via Entra token (actor_type = "admin")
3. Ticket fields validated and updated
4. Activity log created:
   - actor: admin@company.com (extracted from token)
   - action: "updated_ticket"
   - old_values: {previous field values}
   - updated_fields: {new field values}
5. Notification created for ticket creator:
   - email: ticket_creator@company.com
   - message: "Your ticket TCKT-01 has been updated: status to In Progress, priority to High"
   - read: false
6. Response includes success message and updated ticket
```

### When User Views Notifications:
```
1. User clicks notification bell icon
2. Frontend calls GET /api/notifications?email=user@company.com
3. Backend queries all notifications for that email
4. Frontend renders list with unread count
5. User clicks a notification to mark as read
6. Frontend calls PATCH /api/notifications/{notificationId}
7. Backend updates notification.read = true
8. Frontend re-renders updated list
```

---

## Activity Log Features

- **Actor Identification**: Correctly identifies if action was performed by admin or user
- **Admin Source**: Email extracted from Microsoft Entra ID token (not from request body)
- **Before/After Values**: Stores both old and new values for audit trail
- **Timestamp Tracking**: ISO format timestamps in UTC timezone
- **Ticket History**: Easy to retrieve complete action history for any ticket

---

## Notification Features

- **Per-User Storage**: Each user has their own notification list
- **Read Status Tracking**: Distinguish between read/unread notifications
- **Auto-Generated Messages**: Human-readable messages describing what changed
- **Field Tracking**: Records exactly which fields were updated
- **Unread Count**: Quickly get count of unread notifications
- **Bulk Operations**: Mark all notifications as read in one operation

---

## Backward Compatibility

- Existing ticket update functionality remains unchanged
- Existing ticket retrieval APIs unaffected
- Activity logs and notifications are new collections in Cosmos DB
- No breaking changes to existing endpoints

---

## Testing Checklist

- [ ] Admin updates ticket → verify activity log created with proper actor email
- [ ] Admin updates ticket → verify notification created for ticket creator
- [ ] User calls GET /api/notifications → verify correct notifications returned
- [ ] User calls PATCH /api/notifications/{id} → verify notification marked as read
- [ ] User calls PATCH /api/notifications/all → verify all marked as read
- [ ] Frontend notification dropdown shows real data from backend
- [ ] Clicking notification in UI marks it as read
- [ ] Unread count updates correctly in UI
- [ ] Multiple admins updating tickets → verify each has own activity log entries
