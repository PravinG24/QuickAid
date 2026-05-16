import azure.functions as func
import logging
import json
import os
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, exceptions

from shared.secrets import get_secret
from shared.admin_auth import authorize_admin_request

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("update_ticket function triggered.")

    payload, auth_type, error_message = authorize_admin_request(req)
    if not payload:
        return func.HttpResponse(
            json.dumps({"error": error_message or "Unauthorized."}),
            status_code=401,
            mimetype="application/json",
        )

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
    allowed_updates = ["status", "priority", "assignedTeam", "adminNotes", "category"]
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
    if "status" in updates and updates["status"] not in ["Open", "In Progress", "Resolved", "Closed"]:
        return func.HttpResponse(
            json.dumps({"error": "Invalid status. Allowed values: Open, In Progress, Resolved, Closed"}),
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
        cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
        client    = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
        database  = client.get_database_client(os.environ["COSMOS_DATABASE"])
        container = database.get_container_client(os.environ["COSMOS_CONTAINER"])

        # ── Find the ticket ──────────────────────────────────────────────────
        find_query  = "SELECT * FROM c WHERE c.type = 'ticket' AND (c.id = @ticketId OR c.ticketId = @ticketId)"
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

        # Track changes for timeline and notifications
        changes = []
        for key, value in updates.items():
            old_value = ticket.get(key)
            if old_value != value:
                changes.append({
                    "field": key,
                    "old_value": old_value,
                    "new_value": value,
                })
            ticket[key] = value

        # ── Update timestamp ────────────────────────────────────────────────
        now = datetime.now(timezone.utc)
        ticket["updatedAt"] = now.isoformat()
        ticket["updated_at"] = ticket["updatedAt"]

        # ── Add timeline entries for changes ────────────────────────────────
        if changes:
            if "timeline" not in ticket:
                ticket["timeline"] = []
            
            for change in changes:
                field = change["field"]
                old_val = change["old_value"]
                new_val = change["new_value"]
                
                # Create readable label for the change
                if field == "status":
                    label = f"Status changed from {old_val or 'Open'} to {new_val}"
                elif field == "priority":
                    label = f"Priority changed from {old_val or 'Low'} to {new_val}"
                elif field == "assignedTeam":
                    label = f"Assigned team changed from {old_val or 'Unassigned'} to {new_val}"
                elif field == "adminNotes":
                    label = "Admin notes updated"
                elif field == "category":
                    label = f"Category changed to {new_val}"
                else:
                    label = f"{field} updated"
                
                ticket["timeline"].append({
                    "label": label,
                    "by": "Admin",
                    "at": now.isoformat(),
                })
            
            # ── Create notification for ticket creator ──────────────────
            # Extract ticket creator email
            creator_email = ticket.get("email") or ""
            creator_name = ticket.get("requesterName") or ticket.get("user") or "Requester"
            
            if creator_email:
                # Create notification document
                notification = {
                    "id": f"notif-{ticket_id}-{len(ticket.get('timeline', []))}",
                    "type": "notification",
                    "ticketId": ticket_id,
                    "ticketTitle": ticket.get("title", "Ticket"),
                    "recipient_email": creator_email,
                    "message": f"Your ticket has been updated",
                    "details": f"Admin has updated: {', '.join([c['field'] for c in changes])}",
                    "read": False,
                    "createdAt": now.isoformat(),
                }
                
                try:
                    container.create_item(body=notification)
                    logging.info(f"Notification created for {creator_email} about ticket {ticket_id}")
                except Exception as notif_error:
                    logging.error(f"Failed to create notification: {notif_error}")

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
