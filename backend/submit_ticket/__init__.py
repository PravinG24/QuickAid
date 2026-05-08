import azure.functions as func
import logging
import json
import os
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, exceptions

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("submit_ticket function triggered.")

    # ── Parse request body ──────────────────────────────────────────────────
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body."}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Validate required fields ─────────────────────────────────────────────
    required_fields = ["email", "title", "description", "category"]
    missing = [f for f in required_fields if not body.get(f, "").strip()]
    if missing:
        return func.HttpResponse(
            json.dumps({"error": f"Missing required fields: {', '.join(missing)}"}),
            status_code=400,
            mimetype="application/json"
        )

    email       = body["email"].strip().lower()
    title       = body["title"].strip()
    description = body["description"].strip()
    category    = body["category"].strip()

    # ── Validate category ────────────────────────────────────────────────────
    allowed_categories = ["IT", "HR", "Finance", "Operations", "General"]
    if category not in allowed_categories:
        return func.HttpResponse(
            json.dumps({
                "error": f"Invalid category. Allowed values: {', '.join(allowed_categories)}"
            }),
            status_code=400,
            mimetype="application/json"
        )

    # ── Connect to Cosmos DB ─────────────────────────────────────────────────
    client    = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=os.environ["COSMOS_KEY"])
    database  = client.get_database_client(os.environ["COSMOS_DATABASE"])
    container = database.get_container_client(os.environ["COSMOS_CONTAINER"])

    # ── Generate TCKT-XX ID ──────────────────────────────────────────────────
    count_query  = "SELECT VALUE COUNT(1) FROM c WHERE c.type = 'ticket'"
    count_result = list(container.query_items(
        query=count_query,
        enable_cross_partition_query=True
    ))
    count     = count_result[0] if count_result else 0
    ticket_id = f"TCKT-{str(count + 1).zfill(2)}"

    # ── Build ticket document ────────────────────────────────────────────────
    now    = datetime.now(timezone.utc)
    ticket = {
        "id":          ticket_id,
        "ticketId":    ticket_id,
        "type":        "ticket",
        "email":       email,
        "title":       title,
        "description": description,
        "category":    category,
        "status":      "Open",
        "createdAt":   now.isoformat(),
        "updatedAt":   now.isoformat(),
    }

    # ── Write to Cosmos DB ───────────────────────────────────────────────────
    try:
        container.create_item(body=ticket)

    except exceptions.CosmosResourceExistsError:
        return func.HttpResponse(
            json.dumps({"error": "Ticket ID conflict. Please try again."}),
            status_code=409,
            mimetype="application/json"
        )
    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to save ticket. Please try again later."}),
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

    # ── Success ──────────────────────────────────────────────────────────────
    return func.HttpResponse(
        json.dumps({
            "message":   "Ticket submitted successfully.",
            "ticketId":  ticket_id,
            "type":      "ticket",
            "status":    "Open",
            "createdAt": now.isoformat()
        }), 
        status_code=201,
        mimetype="application/json"
    )