import os
from datetime import datetime, timezone

from azure.cosmos import CosmosClient

from shared.secrets import get_secret


COSMOS_INTERNAL_FIELDS = {"_rid", "_self", "_etag", "_attachments", "_ts"}
STATUS_ALIASES = {
    "new": "Open",
    "open": "Open",
    "inprogress": "In Progress",
    "in progress": "In Progress",
    "resolved": "Resolved",
    "closed": "Closed",
}
PRIORITY_ALIASES = {
    "urgent": "High",
    "high": "High",
    "medium": "Medium",
    "normal": "Medium",
    "low": "Low",
}


def get_container():
    cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
    client = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
    database = client.get_database_client(os.environ["COSMOS_DATABASE"])
    return database.get_container_client(os.environ["COSMOS_CONTAINER"])


def strip_cosmos_fields(item):
    return {key: value for key, value in item.items() if key not in COSMOS_INTERNAL_FIELDS}


def normalize_status(value):
    normalized = str(value or "").strip()
    return STATUS_ALIASES.get(normalized.lower().replace("_", " "), normalized or "Open")


def normalize_priority(value):
    normalized = str(value or "").strip()
    return PRIORITY_ALIASES.get(normalized.lower().replace("_", " "), normalized or "Medium")


def normalize_ticket(item):
    source = strip_cosmos_fields(item or {})
    created_at = source.get("created_at") or source.get("createdAt") or source.get("submitted_at")
    updated_at = source.get("updated_at") or source.get("updatedAt") or created_at
    title = source.get("issue") or source.get("subject") or source.get("title") or "No issue provided"
    email = source.get("email") or ""
    requester = (
        source.get("user")
        or source.get("requesterName")
        or source.get("name")
        or (email.split("@")[0] if email else "N/A")
    )
    assigned_team = (
        source.get("assignedTeam")
        or source.get("assigned_to")
        or source.get("assignedTo")
        or source.get("assigned_team")
        or source.get("category")
        or "Unassigned"
    )
    ticket_id = source.get("ticketId") or source.get("ticket_id") or source.get("id") or "N/A"
    return {
        **source,
        "id": source.get("id") or ticket_id,
        "ticketId": ticket_id,
        "ticket_id": ticket_id,
        "user": requester,
        "email": email,
        "issue": title,
        "subject": source.get("subject") or title,
        "title": source.get("title") or title,
        "category": source.get("category") or "General",
        "priority": normalize_priority(source.get("priority")),
        "status": normalize_status(source.get("status")),
        "assignedTeam": assigned_team,
        "assigned_to": assigned_team,
        "created_at": created_at,
        "submitted_at": source.get("submitted_at") or created_at,
        "updated_at": updated_at,
        "createdAt": source.get("createdAt") or created_at,
        "updatedAt": source.get("updatedAt") or updated_at,
    }


def query_all_tickets(container):
    items = list(
        container.query_items(
            query="SELECT * FROM c WHERE c.type = 'ticket' ORDER BY c.createdAt DESC",
            enable_cross_partition_query=True,
        )
    )
    return [normalize_ticket(item) for item in items]


def find_ticket(container, ticket_id):
    query = "SELECT * FROM c WHERE c.type = 'ticket' AND (c.id = @id OR c.ticketId = @id)"
    items = list(
        container.query_items(
            query=query,
            parameters=[{"name": "@id", "value": ticket_id}],
            enable_cross_partition_query=True,
        )
    )
    return items[0] if items else None


def update_ticket_fields(container, ticket_id, fields):
    item = find_ticket(container, ticket_id)
    if item is None:
        return None
    now = datetime.now(timezone.utc).isoformat()
    item.update(fields)
    item["updatedAt"] = now
    item["updated_at"] = now
    saved = container.upsert_item(body=item)
    return normalize_ticket(saved)
