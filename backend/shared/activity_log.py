"""Activity logging utilities for QuickAid.

Tracks admin and user actions with proper actor identification,
timestamps, and action details.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

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


def create_activity_log(
    actor_email: str,
    actor_type: str,
    action: str,
    ticket_id: str,
    updated_fields: Optional[Dict[str, Any]] = None,
    old_values: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Create an activity log entry for an admin or user action.

    Args:
        actor_email: Email of the user/admin performing the action
        actor_type: "admin" or "user"
        action: Description of the action (e.g., "updated_status", "created_ticket")
        ticket_id: ID of the affected ticket
        updated_fields: Dict of fields that were updated (optional)
        old_values: Dict of old values before the update (optional)

    Returns:
        The created activity log document, or None on error
    """
    try:
        store = _load_store()
        now = datetime.now(timezone.utc)

        log_entry = {
            "id": f"LOG-{now.timestamp()}-{ticket_id}",
            "type": "activity_log",
            "actor": actor_email,
            "actor_type": actor_type,
            "action": action,
            "ticket_id": ticket_id,
            "timestamp": now.isoformat(),
            "updated_fields": updated_fields or {},
            "old_values": old_values or {},
        }

        store["activity_logs"].append(log_entry)
        _save_store(store)

        logging.info(
            "Activity logged: actor=%s type=%s action=%s ticket=%s",
            actor_email, actor_type, action, ticket_id,
        )
        return log_entry
    except Exception as exc:
        logging.error("Failed to create activity log: %s", exc)
        return None


def get_activity_log_for_ticket(ticket_id: str) -> list:
    """Retrieve all activity log entries for a specific ticket.

    Args:
        ticket_id: ID of the ticket

    Returns:
        List of activity log entries sorted by timestamp (newest first)
    """
    try:
        store = _load_store()
        logs = [
            entry for entry in store.get("activity_logs", [])
            if str(entry.get("ticket_id", "")) == str(ticket_id)
        ]
        return sorted(logs, key=lambda entry: entry.get("timestamp", ""), reverse=True)
    except Exception as exc:
        logging.error("Failed to retrieve activity logs for ticket %s: %s", ticket_id, exc)
        return []


def get_activity_log_by_actor(actor_email: str, actor_type: Optional[str] = None) -> list:
    """Retrieve all activity log entries for a specific actor.

    Args:
        actor_email: Email of the actor
        actor_type: Optional filter for "admin" or "user"

    Returns:
        List of activity log entries sorted by timestamp (newest first)
    """
    try:
        actor_email_normalized = str(actor_email or "").lower().strip()
        store = _load_store()
        logs = [
            entry for entry in store.get("activity_logs", [])
            if str(entry.get("actor", "")).lower().strip() == actor_email_normalized
            and (actor_type is None or str(entry.get("actor_type", "")).lower().strip() == str(actor_type).lower().strip())
        ]
        return sorted(logs, key=lambda entry: entry.get("timestamp", ""), reverse=True)
    except Exception as exc:
        logging.error("Failed to retrieve activity logs for actor %s: %s", actor_email, exc)
        return []
