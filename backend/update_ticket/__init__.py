import azure.functions as func
import logging
import json
import os
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, exceptions

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("update_ticket function triggered.")

    # ── Get ticket ID from route ─────────────────────────────────────────────
    ticket_id = req.route_params.get("ticketId", "").strip()
    if not ticket_id:
        return func.HttpResponse(
            json.dumps({"error": "ticketId is required in the URL."}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Parse request body ───────────────────────────────────────────────────
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body."}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Validate allowed fields ──────────────────────────────────────────────
    allowed_updates = ["status", "priority", "assignedTo", "adminNotes", "category"]
    updates = {k: v for k, v in body.items() if k in allowed_updates}

    if not updates:
        return func.HttpResponse(
            json.dumps({
                "error": f"Nothing to update. Allowed fields: {', '.join(allowed_updates)}"
            }),
            status_code=400,
            mimetype="application/json"
        )

    # ── Validate status ──────────────────────────────────────────────────────
    if "status" in updates and updates["status"] not in ["Open", "Closed"]:
        return func.HttpResponse(
            json.dumps({"error": "Invalid status. Allowed values: Open, Closed"}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Validate priority ────────────────────────────────────────────────────
    if "priority" in updates and updates["priority"] not in ["Low", "Medium", "High"]:
        return func.HttpResponse(
            json.dumps({"error": "Invalid priority. Allowed values: Low, Medium, High"}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Validate category ────────────────────────────────────────────────────
    if "category" in updates:
        allowed_categories = ["IT", "HR", "Finance", "Operations", "General"]
        if updates["category"] not in allowed_categories:
            return func.HttpResponse(
                json.dumps({
                    "error": f"Invalid category. Allowed values: {', '.join(allowed_categories)}"
                }),
                status_code=400,
                mimetype="application/json"
            )

    # ── Connect to Cosmos DB ─────────────────────────────────────────────────
    try:
        client    = CosmosClient.from_connection_string(os.environ["COSMOS_CONNECTION_STRING"])
        database  = client.get_database_client(os.environ["COSMOS_DATABASE_NAME"])
        container = database.get_container_client(os.environ["COSMOS_CONTAINER_NAME"])

        # ── Find the ticket ──────────────────────────────────────────────────
        find_query  = "SELECT * FROM c WHERE c.type = 'ticket' AND c.id = @ticketId"
        find_params = [{"name": "@ticketId", "value": ticket_id}]
        results = list(container.query_items(
            query=find_query,
            parameters=find_params,
            enable_cross_partition_query=True
        ))

        if not results:
            return func.HttpResponse(
                json.dumps({"error": f"Ticket '{ticket_id}' not found."}),
                status_code=404,
                mimetype="application/json"
            )

        # ── Apply updates ────────────────────────────────────────────────────
        ticket = results[0]

        # Set default priority to Low if not already set
        if "priority" not in ticket:
            ticket["priority"] = "Low"

        for key, value in updates.items():
            ticket[key] = value

        ticket["updatedAt"] = datetime.now(timezone.utc).isoformat()

        # ── Save updated ticket ──────────────────────────────────────────────
        container.replace_item(item=ticket["id"], body=ticket)

    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to update ticket. Please try again later."}),
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
    clean_ticket = {k: v for k, v in ticket.items() if k not in cosmos_internal}

    # ── Success ──────────────────────────────────────────────────────────────
    return func.HttpResponse(
        json.dumps({
            "message":  "Ticket updated successfully.",
            "ticket":   clean_ticket
        }),
        status_code=200,
        mimetype="application/json"
    )