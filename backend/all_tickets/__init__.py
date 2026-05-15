import azure.functions as func
import logging
import json
from azure.cosmos import CosmosClient, exceptions
import os

from shared.secrets import get_secret
from shared.admin_auth import authorize_admin_request


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("get_all_tickets function triggered.")

    payload, auth_type, error_message = authorize_admin_request(req)
    if not payload:
        return func.HttpResponse(
            json.dumps({"error": error_message or "Unauthorized."}),
            status_code=401,
            mimetype="application/json",
        )

    # ── Optional filters from query params ──────────────────────────────────
    status_filter   = req.params.get("status", "").strip()
    category_filter = req.params.get("category", "").strip()
    email_filter    = req.params.get("email", "").strip().lower()

    # ── Build query ──────────────────────────────────────────────────────────
    query  = "SELECT * FROM c WHERE c.type = 'ticket'"
    params = []

    if status_filter:
        query += " AND c.status = @status"
        params.append({"name": "@status", "value": status_filter})

    if category_filter:
        query += " AND c.category = @category"
        params.append({"name": "@category", "value": category_filter})

    if email_filter:
        query += " AND c.email = @email"
        params.append({"name": "@email", "value": email_filter})

    query += " ORDER BY c.createdAt DESC"

    # ── Connect to Cosmos DB ─────────────────────────────────────────────────
    try:
        cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
        client    = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
        database  = client.get_database_client(os.environ["COSMOS_DATABASE"])
        container = database.get_container_client(os.environ["COSMOS_CONTAINER"])

        items = list(container.query_items(
            query=query,
            parameters=params if params else None,
            enable_cross_partition_query=True
        ))

    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to retrieve tickets. Please try again later."}),
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
    tickets = [
        {k: v for k, v in item.items() if k not in cosmos_internal}
        for item in items
    ]

    # ── Return response ──────────────────────────────────────────────────────
    # ── Calculate metrics ───────────────────────────────────────────────────────
    status_counts = {}
    category_counts = {}
    priority_counts = {}
    
    for ticket in items:
        status = ticket.get("status", "Unknown")
        category = ticket.get("category", "Unknown")
        priority = ticket.get("priority", "Unknown")
        
        status_counts[status] = status_counts.get(status, 0) + 1
        category_counts[category] = category_counts.get(category, 0) + 1
        priority_counts[priority] = priority_counts.get(priority, 0) + 1
    
    # ── Return response with metrics ──────────────────────────────────────────
    return func.HttpResponse(
        json.dumps({
            "totalCount": len(tickets),
            "metrics": {
                "byStatus": status_counts,
                "byCategory": category_counts,
                "byPriority": priority_counts
            },
            "filters": {
                "status":   status_filter   or None,
                "category": category_filter or None,
                "email":    email_filter    or None
            },
            "tickets": tickets
        }),
        status_code=200,
        mimetype="application/json"
    )
