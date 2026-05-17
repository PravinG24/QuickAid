"""Activity logging utilities for QuickAid.

Tracks admin and user actions with proper actor identification,
timestamps, and action details.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from azure.cosmos import CosmosClient

from shared.secrets import get_secret


def get_container():
    """Get Cosmos DB container for activity logs."""
    cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
    client = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
    database = client.get_database_client(os.environ["COSMOS_DATABASE"])
    return database.get_container_client(os.environ["COSMOS_CONTAINER"])


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
        container = get_container()
        now = datetime.now(timezone.utc)
        
        log_entry = {
            "id": f"LOG-{now.timestamp()}-{ticket_id}",
            "type": "activity_log",
            "actor": actor_email,
            "actor_type": actor_type,  # "admin" or "user"
            "action": action,
            "ticket_id": ticket_id,
            "timestamp": now.isoformat(),
            "updated_fields": updated_fields or {},
            "old_values": old_values or {},
        }
        
        container.create_item(body=log_entry)
        logging.info(
            "Activity logged: actor=%s type=%s action=%s ticket=%s",
            actor_email, actor_type, action, ticket_id
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
        container = get_container()
        query = "SELECT * FROM c WHERE c.type = 'activity_log' AND c.ticket_id = @ticket_id ORDER BY c.timestamp DESC"
        params = [{"name": "@ticket_id", "value": ticket_id}]
        
        logs = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        return logs
        
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
        container = get_container()
        
        if actor_type:
            query = "SELECT * FROM c WHERE c.type = 'activity_log' AND c.actor = @actor AND c.actor_type = @actor_type ORDER BY c.timestamp DESC"
            params = [
                {"name": "@actor", "value": actor_email.lower()},
                {"name": "@actor_type", "value": actor_type}
            ]
        else:
            query = "SELECT * FROM c WHERE c.type = 'activity_log' AND c.actor = @actor ORDER BY c.timestamp DESC"
            params = [{"name": "@actor", "value": actor_email.lower()}]
        
        logs = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        
        return logs
        
    except Exception as exc:
        logging.error("Failed to retrieve activity logs for actor %s: %s", actor_email, exc)
        return []
