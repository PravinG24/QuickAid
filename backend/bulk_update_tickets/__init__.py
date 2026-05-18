import json
import logging
from datetime import datetime, timezone
from typing import Optional

import azure.functions as func
from azure.cosmos import exceptions

from shared.activity_log import create_activity_log
from shared.admin_auth import authorize_admin_request
from shared.admin_tickets import get_container, find_ticket, normalize_ticket, strip_cosmos_fields
from shared.notifications import create_notification


ALLOWED_UPDATES = {"status", "priority", "assignedTo", "adminNotes", "category"}
TRACKED_UPDATE_FIELDS = {"status", "priority", "assignedTo", "category"}
ALLOWED_STATUSES = {"Open", "In Progress", "Resolved", "Closed"}
ALLOWED_PRIORITIES = {"Low", "Medium", "High"}
ALLOWED_CATEGORIES = {"IT", "HR", "Finance", "Operations", "General"}


def _validate_updates(updates: dict) -> Optional[str]:
    if "status" in updates and updates["status"] not in ALLOWED_STATUSES:
        return "Invalid status. Allowed values: Open, In Progress, Resolved, Closed"
    if "priority" in updates and updates["priority"] not in ALLOWED_PRIORITIES:
        return "Invalid priority. Allowed values: Low, Medium, High"
    if "category" in updates and updates["category"] not in ALLOWED_CATEGORIES:
        return "Invalid category. Allowed values: IT, HR, Finance, Operations, General"
    return None


def _build_notification_message(ticket_id: str, tracked_changes: dict) -> str:
    updated_field_names = []
    if "status" in tracked_changes:
        updated_field_names.append(f"status to {tracked_changes['status']}")
    if "priority" in tracked_changes:
        updated_field_names.append(f"priority to {tracked_changes['priority']}")
    if "assignedTo" in tracked_changes:
        updated_field_names.append(f"assigned to {tracked_changes['assignedTo']}")
    if "category" in tracked_changes:
        updated_field_names.append(f"category to {tracked_changes['category']}")

    if not updated_field_names:
        return f"Your ticket {ticket_id} has been updated."
    return f"Your ticket {ticket_id} has been updated: {', '.join(updated_field_names)}"


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("bulk_update_tickets function triggered.")

    payload, auth_type, error_message = authorize_admin_request(req)
    if not payload:
        return func.HttpResponse(
            json.dumps({"error": error_message or "Unauthorized."}),
            status_code=401,
            mimetype="application/json",
        )

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body."}),
            status_code=400,
            mimetype="application/json",
        )

    ticket_ids = body.get("ticketIds")
    if not isinstance(ticket_ids, list) or not ticket_ids:
        return func.HttpResponse(
            json.dumps({"error": "ticketIds must be a non-empty array."}),
            status_code=400,
            mimetype="application/json",
        )

    raw_updates = body.get("updates") if isinstance(body.get("updates"), dict) else {}
    if "assignedTeam" in raw_updates and "assignedTo" not in raw_updates:
        raw_updates["assignedTo"] = raw_updates["assignedTeam"]

    updates = {key: value for key, value in raw_updates.items() if key in ALLOWED_UPDATES}
    if not updates:
        return func.HttpResponse(
            json.dumps({"error": "Nothing to update."}),
            status_code=400,
            mimetype="application/json",
        )

    validation_error = _validate_updates(updates)
    if validation_error:
        return func.HttpResponse(
            json.dumps({"error": validation_error}),
            status_code=400,
            mimetype="application/json",
        )

    admin_email = str(
        payload.get("preferred_username")
        or payload.get("email")
        or payload.get("upn")
        or "unknown@unknown.com"
    ).strip().lower()

    try:
        container = get_container()
        updated_tickets = []
        missing_ticket_ids = []
        unchanged_ticket_ids = []

        for raw_ticket_id in ticket_ids:
            ticket_id = str(raw_ticket_id or "").strip()
            if not ticket_id:
                continue

            ticket = find_ticket(container, ticket_id)
            if ticket is None:
                missing_ticket_ids.append(ticket_id)
                continue

            if "priority" not in ticket:
                ticket["priority"] = "Low"

            tracked_old_values = {}
            tracked_changed_fields = {}
            has_changes = False

            for key, value in updates.items():
                old_value = ticket.get(key)
                if old_value == value:
                    continue
                has_changes = True
                ticket[key] = value
                if key == "assignedTo":
                    ticket["assignedTo"] = value
                    ticket.pop("assignedTeam", None)
                    ticket.pop("assigned_to", None)
                    ticket.pop("assigned_team", None)
                if key in TRACKED_UPDATE_FIELDS:
                    tracked_old_values[key] = old_value
                    tracked_changed_fields[key] = value

            if not has_changes:
                unchanged_ticket_ids.append(ticket_id)
                updated_tickets.append(normalize_ticket(strip_cosmos_fields(ticket)))
                continue

            now = datetime.now(timezone.utc).isoformat()
            ticket["updatedAt"] = now
            ticket["updated_at"] = now

            container.replace_item(item=ticket["id"], body=ticket)

            if tracked_changed_fields:
                create_activity_log(
                    actor_email=admin_email,
                    actor_type="admin",
                    action="updated_ticket",
                    ticket_id=ticket_id,
                    updated_fields=tracked_changed_fields,
                    old_values=tracked_old_values,
                )

                ticket_creator_email = str(ticket.get("email") or "").strip()
                if ticket_creator_email:
                    create_notification(
                        email=ticket_creator_email,
                        ticket_id=ticket_id,
                        message=_build_notification_message(ticket_id, tracked_changed_fields),
                        updated_fields=tracked_changed_fields,
                    )

            updated_tickets.append(normalize_ticket(strip_cosmos_fields(ticket)))

    except exceptions.CosmosHttpResponseError as exc:
        logging.error("Cosmos DB error during bulk update: %s", exc)
        return func.HttpResponse(
            json.dumps({"error": "Failed to update tickets. Please try again later."}),
            status_code=500,
            mimetype="application/json",
        )
    except Exception as exc:
        logging.error("Unexpected error during bulk update: %s", exc)
        return func.HttpResponse(
            json.dumps({"error": "An unexpected error occurred."}),
            status_code=500,
            mimetype="application/json",
        )

    return func.HttpResponse(
        json.dumps(
            {
                "message": "Tickets updated successfully.",
                "updatedCount": len(updated_tickets) - len(unchanged_ticket_ids),
                "unchangedCount": len(unchanged_ticket_ids),
                "missingTicketIds": missing_ticket_ids,
                "tickets": updated_tickets,
            }
        ),
        status_code=200,
        mimetype="application/json",
    )
