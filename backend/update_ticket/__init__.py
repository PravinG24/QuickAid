import azure.functions as func
import logging
import json
import os
import uuid
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, exceptions

from shared.secrets import get_secret
from shared.admin_auth import authorize_admin_request
from shared.activity_log import create_activity_log
from shared.notifications import create_notification

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
        old_values = {}  # Store old values for activity log
        changed_fields = {}

        # New tickets can remain unprioritized until admin triage.
        if "priority" not in ticket:
            ticket["priority"] = ""

        # Capture old values and determine which fields actually changed
        for key, value in updates.items():
            if key in ticket:
                old_values[key] = ticket[key]
            if ticket.get(key) != value:
                changed_fields[key] = value

        # Apply updates
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
        ticket["isUpdated"] = True

        # ── Extract admin email from Entra token ─────────────────────────────
        admin_email = str(
            payload.get("preferred_username")
            or payload.get("email")
            or payload.get("upn")
            or "unknown@unknown.com"
        ).strip().lower()

        # ── Save updated ticket ──────────────────────────────────────────────
        container.replace_item(item=ticket["id"], body=ticket)

        # ── Log activity with proper admin identification ────────────────────
        if changed_fields:
            create_activity_log(
                actor_email=admin_email,
                actor_type="admin",
                action="updated_ticket",
                ticket_id=ticket_id,
                updated_fields=changed_fields,
                old_values=old_values
            )

        # ── Create notification for ticket creator ──────────────────────────
        if changed_fields:
            ticket_creator_email = str(ticket.get("email") or "").strip()
            if ticket_creator_email:
                updated_field_names = []
                if "status" in changed_fields:
                    updated_field_names.append(f"status to {changed_fields['status']}")
                if "priority" in changed_fields:
                    updated_field_names.append(f"priority to {changed_fields['priority']}")
                if "assignedTeam" in changed_fields:
                    updated_field_names.append(f"assigned team to {changed_fields['assignedTeam']}")
                if "category" in changed_fields:
                    updated_field_names.append(f"category to {changed_fields['category']}")
                if "adminNotes" in changed_fields:
                    updated_field_names.append("admin notes updated")

                if updated_field_names:
                    fields_str = ", ".join(updated_field_names)
                    notification_message = f"Your ticket {ticket_id} has been updated: {fields_str}"
                else:
                    notification_message = f"Your ticket {ticket_id} has been updated."

                create_notification(
                    email=ticket_creator_email,
                    ticket_id=ticket_id,
                    message=notification_message,
                    updated_fields=changed_fields
                )

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
