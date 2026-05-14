import azure.functions as func
import logging
import json
import os
from azure.cosmos import CosmosClient, exceptions

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("get_all_tickets function triggered.")

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
        client    = CosmosClient.from_connection_string(os.environ["COSMOS_CONNECTION_STRING"])
        database  = client.get_database_client(os.environ["COSMOS_DATABASE_NAME"])
        container = database.get_container_client(os.environ["COSMOS_CONTAINER_NAME"])

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
    return func.HttpResponse(
        json.dumps({
            "totalCount": len(tickets),
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
