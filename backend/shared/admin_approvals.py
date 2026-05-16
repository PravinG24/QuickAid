from __future__ import annotations

import os
from datetime import datetime, timezone

from azure.cosmos import CosmosClient

from shared.secrets import get_secret


def get_bootstrap_admin_email() -> str:
    return str(os.environ.get("ENTRA_BOOTSTRAP_ADMIN_EMAIL", "admin@campus.edu")).strip().lower()


def get_container():
    cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
    client = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
    database = client.get_database_client(os.environ["COSMOS_DATABASE"])
    return database.get_container_client(os.environ["COSMOS_CONTAINER"])


def normalize_admin_request(item):
    source = dict(item or {})
    email = str(source.get("email", "")).strip().lower()
    status = str(source.get("approvalStatus") or source.get("status") or "pending").strip().lower()
    reviewed_by = source.get("reviewedBy") or source.get("approvedBy") or ""
    requested_at = source.get("requestedAt") or source.get("createdAt") or source.get("updatedAt")
    requester = source.get("requester") or source.get("name") or email.split("@")[0] or "Admin"
    return {
        **source,
        "id": source.get("id") or source.get("adminId") or "",
        "adminId": source.get("adminId") or source.get("id") or "",
        "type": source.get("type") or "admin",
        "name": requester,
        "requester": requester,
        "email": email,
        "role": source.get("role") or "admin",
        "department": source.get("department") or "Administration Office",
        "approvalStatus": status,
        "status": status,
        "reviewedBy": reviewed_by,
        "requestedAt": requested_at,
        "date": source.get("date") or requested_at,
        "createdAt": source.get("createdAt") or requested_at,
        "updatedAt": source.get("updatedAt") or requested_at,
    }


def list_admin_requests(container, status: str | None = None):
    query = "SELECT * FROM c WHERE c.type = 'admin'"
    params = []
    normalized_status = str(status or "").strip().lower()
    if normalized_status and normalized_status != "all":
        query += " AND LOWER(c.approvalStatus) = @status"
        params.append({"name": "@status", "value": normalized_status})
    query += " ORDER BY c.createdAt DESC"
    items = list(
        container.query_items(
            query=query,
            parameters=params if params else None,
            enable_cross_partition_query=True,
        )
    )
    return [normalize_admin_request(item) for item in items]


def find_admin_request_by_email(container, email: str):
    query = "SELECT * FROM c WHERE c.type = 'admin' AND LOWER(c.email) = @email"
    items = list(
        container.query_items(
            query=query,
            parameters=[{"name": "@email", "value": str(email or "").strip().lower()}],
            enable_cross_partition_query=True,
        )
    )
    return normalize_admin_request(items[0]) if items else None


def find_admin_request_by_id(container, admin_id: str):
    query = "SELECT * FROM c WHERE c.type = 'admin' AND (c.id = @id OR c.adminId = @id)"
    items = list(
        container.query_items(
            query=query,
            parameters=[{"name": "@id", "value": str(admin_id or "").strip()}],
            enable_cross_partition_query=True,
        )
    )
    return normalize_admin_request(items[0]) if items else None


def set_admin_request_status(container, admin_id: str, status: str, reviewed_by: str):
    request = find_admin_request_by_id(container, admin_id)
    if request is None:
        return None

    now = datetime.now(timezone.utc).isoformat()
    next_status = str(status or "").strip().lower()
    request["approvalStatus"] = next_status
    request["status"] = next_status
    request["reviewedBy"] = reviewed_by
    request["reviewedAt"] = now
    request["updatedAt"] = now
    saved = container.upsert_item(body=request)
    return normalize_admin_request(saved)
