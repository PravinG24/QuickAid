# QuickAid Activity Log & Notification API Reference

## Activity Log

### Data Model
Activity logs track all admin actions on tickets with proper actor identification.

```json
{
  "id": "LOG-1234567890.123-TCKT-01",
  "type": "activity_log",
  "actor": "admin@company.com",
  "actor_type": "admin",
  "action": "updated_ticket",
  "ticket_id": "TCKT-01",
  "timestamp": "2026-05-17T10:30:45.123456+00:00",
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

### Querying Activity Logs (Internal)
Use in backend code:
```python
from shared.activity_log import get_activity_log_for_ticket, get_activity_log_by_actor

# Get all actions on a specific ticket
logs = get_activity_log_for_ticket("TCKT-01")

# Get all actions by an admin
logs = get_activity_log_by_actor("admin@company.com", actor_type="admin")
```

---

## Notifications API

### 1. GET /api/notifications
Retrieve notifications for a user.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | ✅ Yes | User's email address |
| unread_only | boolean | ❌ No | Filter to unread only (default: false) |

**Example Request:**
```bash
GET /api/notifications?email=user@company.com
GET /api/notifications?email=user@company.com&unread_only=true
```

**Response: 200 OK**
```json
{
  "email": "user@company.com",
  "notifications": [
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
      "timestamp": "2026-05-17T10:30:45.123456+00:00",
      "read": false
    },
    {
      "id": "NOTIF-550e8400-e29b-41d4-a716-446655440001",
      "type": "notification",
      "email": "user@company.com",
      "ticket_id": "TCKT-02",
      "message": "Your ticket TCKT-02 has been updated: status to Resolved",
      "updated_fields": {
        "status": "Resolved"
      },
      "timestamp": "2026-05-17T09:15:20.654321+00:00",
      "read": true
    }
  ],
  "unread_count": 1,
  "total_count": 2
}
```

**Error Responses:**
- `400 Bad Request`: Missing email parameter
- `500 Internal Server Error`: Database error

---

### 2. PATCH /api/notifications/{notificationId}
Mark a single notification as read.

**Parameters:**
| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| notificationId | string | URL path | ✅ Yes | Notification ID from notification object |

**Example Request:**
```bash
PATCH /api/notifications/NOTIF-550e8400-e29b-41d4-a716-446655440000
```

**Response: 200 OK**
```json
{
  "message": "Notification marked as read.",
  "notification": {
    "id": "NOTIF-550e8400-e29b-41d4-a716-446655440000",
    "type": "notification",
    "email": "user@company.com",
    "ticket_id": "TCKT-01",
    "message": "Your ticket TCKT-01 has been updated: status to In Progress, priority to High",
    "updated_fields": {
      "status": "In Progress",
      "priority": "High"
    },
    "timestamp": "2026-05-17T10:30:45.123456+00:00",
    "read": true
  }
}
```

**Error Responses:**
- `404 Not Found`: Notification ID not found
- `500 Internal Server Error`: Database error

---

### 3. PATCH /api/notifications/all
Mark all notifications as read for a user.

**Parameters:**
| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| email | string | Query | ✅ Yes | User's email address |

**Example Request:**
```bash
PATCH /api/notifications/all?email=user@company.com
```

**Response: 200 OK**
```json
{
  "message": "All notifications marked as read.",
  "email": "user@company.com"
}
```

**Error Responses:**
- `400 Bad Request`: Missing email parameter
- `500 Internal Server Error`: Database error

---

## Usage Examples

### Frontend - Get Unread Notifications
```javascript
async function loadUnreadNotifications(email) {
  const response = await fetch(
    `${API_BASE}/api/notifications?email=${encodeURIComponent(email)}&unread_only=true`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Correlation-Id": crypto.randomUUID(),
      },
    }
  );

  if (response.ok) {
    const data = await response.json();
    console.log(`Unread notifications: ${data.unread_count}`);
    return data.notifications;
  }
}
```

### Frontend - Mark Notification as Read
```javascript
async function markAsRead(notificationId) {
  const response = await fetch(
    `${API_BASE}/api/notifications/${notificationId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": crypto.randomUUID(),
      },
    }
  );

  return response.ok;
}
```

### Frontend - Mark All as Read
```javascript
async function markAllAsRead(email) {
  const response = await fetch(
    `${API_BASE}/api/notifications/all?email=${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": crypto.randomUUID(),
      },
    }
  );

  return response.ok;
}
```

### Backend - Get Notifications Programmatically
```python
from shared.notifications import get_notifications_for_user, get_unread_notification_count

# Get all notifications for a user
notifications = get_notifications_for_user("user@company.com")

# Get only unread
unread = get_notifications_for_user("user@company.com", include_read=False)

# Get unread count
count = get_unread_notification_count("user@company.com")
```

---

## Notification Triggers

Notifications are created **only when an admin updates a ticket**.

### Triggering Event
```
Admin makes PATCH /api/update_ticket/{ticketId}
with body containing one or more of:
- status
- priority
- assignedTeam
- category
- adminNotes
```

### Automatic Notification Message
The notification message is automatically generated from updated fields:

| Updated Field | Message Component |
|---------------|------------------|
| status | "status to {newStatus}" |
| priority | "priority to {newPriority}" |
| assignedTeam | "assigned team to {newTeam}" |

**Example:**
- Update: `{"status": "In Progress", "priority": "High"}`
- Message: "Your ticket TCKT-01 has been updated: status to In Progress, priority to High"

---

## Implementation Notes

### Activity Log Actor Identification
- **Source**: Microsoft Entra ID token (verified at endpoint)
- **Fields Extracted**: preferred_username, email, or upn (in order of preference)
- **Normalization**: Converted to lowercase
- **Type**: Always "admin" for activity logs (user creation doesn't log)

### Notification Recipient
- **Source**: ticket.email (from submitted ticket)
- **Timing**: Created immediately after ticket update
- **Frequency**: One notification per update operation
- **Delivery**: Stored in Cosmos DB (no email sending)

### Data Retention
- Activity logs: Kept indefinitely for audit trail
- Notifications: Kept indefinitely (can be archived separately)
- Read status: Never automatically deleted

---

## Error Handling

### Common Errors

**400 Bad Request**
- Missing required parameters
- Invalid parameter format

```json
{
  "error": "email parameter is required."
}
```

**404 Not Found**
- Notification does not exist

```json
{
  "error": "Notification 'NOTIF-123' not found."
}
```

**500 Internal Server Error**
- Database connection failure
- Unexpected system error

```json
{
  "error": "Failed to retrieve notifications. Please try again later."
}
```

---

## Performance Considerations

- Notifications are indexed by email and timestamp
- Unread count query is optimized with `read = false` filter
- Activity logs can be archived after 90 days for compliance
- Consider pagination for users with large notification counts (future enhancement)

---

## Security

- Admin identification via Entra token (cryptographically verified)
- Email normalization prevents case-sensitivity issues
- Notifications returned only for matching email (no cross-user access)
- Activity logs include audit trail for compliance
