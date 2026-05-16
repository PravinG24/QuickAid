import azure.functions as func
import logging
import json
import os
from azure.cosmos import CosmosClient, exceptions

from shared.secrets import get_secret


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("get_notifications function triggered.")

    # ── Get & validate email query param ────────────────────────────────────
    email = req.params.get("email", "").strip().lower()
    if not email:
        return func.HttpResponse(
            json.dumps({"error": "Query parameter 'email' is required."}),
            status_code=400,
            mimetype="application/json"
        )

    # Basic email format check
    if "@" not in email or "." not in email.split("@")[-1]:
        return func.HttpResponse(
            json.dumps({"error": "Invalid email format."}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Optional filters ─────────────────────────────────────────────────────
    unread_only = req.params.get("unreadOnly", "false").lower() in {"true", "1", "yes"}

    # ── Build query ──────────────────────────────────────────────────────────
    query = "SELECT * FROM c WHERE c.type = 'notification' AND c.recipient_email = @email"
    params = [{"name": "@email", "value": email}]

    if unread_only:
        query += " AND c.read = false"

    query += " ORDER BY c.createdAt DESC"

    # ── Query Cosmos DB ──────────────────────────────────────────────────────
    try:
        cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
        client = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
        database = client.get_database_client(os.environ["COSMOS_DATABASE"])
        container = database.get_container_client(os.environ["COSMOS_CONTAINER"])

        items = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))

    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to retrieve notifications. Please try again later."}),
            status_code=500,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "An unexpected error occurred."}),
            status_code=500,
            mimetype="application/json"
        )

    # ── Strip Cosmos internal fields ─────────────────────────────────────────
    cosmos_internal = {"_rid", "_self", "_etag", "_attachments", "_ts"}
    notifications = [
        {k: v for k, v in item.items() if k not in cosmos_internal}
        for item in items
    ]

    # Count unread notifications
    unread_count = sum(1 for notif in notifications if not notif.get("read", False))

    # ── Return response ──────────────────────────────────────────────────────
    return func.HttpResponse(
        json.dumps({
            "email": email,
            "totalCount": len(notifications),
            "unreadCount": unread_count,
            "notifications": notifications
        }),
        status_code=200,
        mimetype="application/json"
    )
