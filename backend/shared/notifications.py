"""Notification management utilities for QuickAid.

Handles creation, retrieval, and status updates for user notifications
when admins update tickets.
"""

import os
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from azure.cosmos import CosmosClient

from shared.secrets import get_secret


def get_container():
    """Get Cosmos DB container for notifications."""
    cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
    client = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
    database = client.get_database_client(os.environ["COSMOS_DATABASE"])
    return database.get_container_client(os.environ["COSMOS_CONTAINER"])


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
        container = get_container()
        now = datetime.now(timezone.utc)
        
        notification = {
            "id": f"NOTIF-{uuid.uuid4()}",
            "type": "notification",
            "email": email.lower().strip(),
            "ticket_id": ticket_id,
            "message": message,
            "updated_fields": updated_fields or {},
            "timestamp": now.isoformat(),
            "read": False,
        }
        
        container.create_item(body=notification)
        logging.info(
            "Notification created for %s: ticket=%s",
            email, ticket_id
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
        container = get_container()
        normalized_email = email.lower().strip()
        
        if include_read:
            query = "SELECT * FROM c WHERE c.type = 'notification' AND c.email = @email ORDER BY c.timestamp DESC"
            params = [{"name": "@email", "value": normalized_email}]
        else:
            query = "SELECT * FROM c WHERE c.type = 'notification' AND c.email = @email AND c.read = false ORDER BY c.timestamp DESC"
            params = [{"name": "@email", "value": normalized_email}]
        
        notifications = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        return notifications
        
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
        container = get_container()
        normalized_email = email.lower().strip()
        
        query = "SELECT VALUE COUNT(1) FROM c WHERE c.type = 'notification' AND c.email = @email AND c.read = false"
        params = [{"name": "@email", "value": normalized_email}]
        
        results = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        return results[0] if results else 0
        
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
        container = get_container()
        
        # Find the notification
        query = "SELECT * FROM c WHERE c.type = 'notification' AND c.id = @id"
        params = [{"name": "@id", "value": notification_id}]
        
        results = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        if not results:
            logging.warning("Notification %s not found", notification_id)
            return None
        
        notification = results[0]
        notification["read"] = True
        
        updated = container.replace_item(item=notification["id"], body=notification)
        logging.info("Notification %s marked as read", notification_id)
        return updated
        
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
        container = get_container()
        normalized_email = email.lower().strip()
        
        # Find all unread notifications
        query = "SELECT * FROM c WHERE c.type = 'notification' AND c.email = @email AND c.read = false"
        params = [{"name": "@email", "value": normalized_email}]
        
        notifications = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        # Mark each as read
        for notif in notifications:
            notif["read"] = True
            container.replace_item(item=notif["id"], body=notif)
        
        logging.info("Marked %d notifications as read for %s", len(notifications), email)
        return True
        
    except Exception as exc:
        logging.error("Failed to mark all notifications as read for %s: %s", email, exc)
        return False
