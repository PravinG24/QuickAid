"""Notification management utilities for QuickAid.

Handles creation, retrieval, and status updates for user notifications
when admins update tickets.
"""

import logging
import uuid
import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from shared.blob_store import read_json_blob, write_json_blob


STORE_CONTAINER = os.environ.get("BLOB_LOG_CONTAINER", "logs")
STORE_BLOB = os.environ.get("BLOB_LOG_FILE", "activitylogs.json")


def _load_store() -> Dict[str, Any]:
    store = read_json_blob(STORE_CONTAINER, STORE_BLOB)
    store.setdefault("activity_logs", [])
    store.setdefault("notifications", [])
    return store


def _save_store(store: Dict[str, Any]) -> bool:
    return write_json_blob(store, STORE_CONTAINER, STORE_BLOB)


def create_notification(
    email: str,
    ticket_id: str,
    message: str,
    updated_fields: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Create a notification for a user when a ticket is updated by an admin.

    Args:
        email: Email of the ticket creator (recipient)
        ticket_id: ID of the ticket being updated
        message: Human-readable notification message
        updated_fields: Dict of fields that were updated (e.g., {"status": "In Progress"})

    Returns:
        The created notification document, or None on error
    """
    try:
        store = _load_store()
        now = datetime.now(timezone.utc)

        notification = {
            "id": f"NOTIF-{uuid.uuid4()}",
            "email": email.lower().strip(),
            "ticket_id": ticket_id,
            "message": message,
            "updated_fields": updated_fields or {},
            "timestamp": now.isoformat(),
            "read": False,
        }

        store["notifications"].append(notification)
        if not _save_store(store):
            logging.error("Failed to persist notification to blob storage.")
            return None

        logging.info(
            "Notification created for %s: ticket=%s",
            email, ticket_id,
        )
        return notification
    except Exception as exc:
        logging.error("Failed to create notification for %s: %s", email, exc)
        return None


def get_notifications_for_user(email: str, include_read: bool = True) -> List[Dict[str, Any]]:
    """Retrieve all notifications for a user.

    Args:
        email: Email of the user
        include_read: If False, return only unread notifications

    Returns:
        List of notification documents sorted by timestamp (newest first)
    """
    try:
        normalized_email = email.lower().strip()
        store = _load_store()
        notifications = [
            notif for notif in store.get("notifications", [])
            if str(notif.get("email", "")).lower().strip() == normalized_email
            and (include_read or notif.get("read") is False)
        ]
        return sorted(notifications, key=lambda item: item.get("timestamp", ""), reverse=True)
    except Exception as exc:
        logging.error("Failed to retrieve notifications for %s: %s", email, exc)
        return []


def get_unread_notification_count(email: str) -> int:
    """Get the count of unread notifications for a user.

    Args:
        email: Email of the user

    Returns:
        Count of unread notifications
    """
    try:
        normalized_email = email.lower().strip()
        store = _load_store()
        return sum(
            1
            for notif in store.get("notifications", [])
            if str(notif.get("email", "")).lower().strip() == normalized_email
            and notif.get("read") is False
        )
    except Exception as exc:
        logging.error("Failed to get unread notification count for %s: %s", email, exc)
        return 0


def mark_notification_as_read(notification_id: str) -> Optional[Dict[str, Any]]:
    """Mark a notification as read.

    Args:
        notification_id: ID of the notification

    Returns:
        The updated notification document, or None on error
    """
    try:
        store = _load_store()
        notification = next(
            (notif for notif in store.get("notifications", []) if notif.get("id") == notification_id),
            None,
        )
        if not notification:
            logging.warning("Notification %s not found", notification_id)
            return None

        notification["read"] = True
        saved = _save_store(store)
        if not saved:
            logging.error("Failed saving blob")
            return None
        logging.info("Notification %s marked as read", notification_id)
        return notification
    except Exception as exc:
        logging.error("Failed to mark notification %s as read: %s", notification_id, exc)
        return None


def mark_all_notifications_as_read(email: str) -> bool:
    """Mark all notifications as read for a user.

    Args:
        email: Email of the user

    Returns:
        True if successful, False otherwise
    """
    try:
        normalized_email = email.lower().strip()
        store = _load_store()
        notifications = store.get("notifications", [])
        updated = False
        for notif in notifications:
            if str(notif.get("email", "")).lower().strip() == normalized_email and notif.get("read") is False:
                notif["read"] = True
                updated = True

        if updated:
            saved = _save_store(store)
    
        if not saved:
            logging.error("Failed saving blob")
            return None

        logging.info("Marked notifications as read for %s", email)
        return True
    except Exception as exc:
        logging.error("Failed to mark all notifications as read for %s: %s", email, exc)
        return False
