import azure.functions as func
import logging
import json
import os
from datetime import datetime, timezone

from azure.cosmos import CosmosClient, exceptions
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from shared.secrets import get_secret


def _send_confirmation_email(
    *,
    to_email: str,
    ticket_id: str,
    title: str,
    category: str,
) -> None:
    """Send a SendGrid confirmation email for a freshly submitted ticket.

    Email failures are logged and swallowed so they never roll back the
    persisted ticket — the ticket exists in Cosmos and is the source of
    truth.
    """
    try:
        sendgrid_key = get_secret("SendGridApiKey", env_fallback="SENDGRID_API_KEY")
        from_email = os.environ.get("SENDGRID_FROM_EMAIL", "").strip()
        if not from_email:
            logging.error(
                "SENDGRID_FROM_EMAIL is not configured; skipping email for %s",
                ticket_id,
            )
            return

        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject=f"QuickAid: ticket {ticket_id} received",
            html_content=(
                f"<p>Hi,</p>"
                f"<p>Your QuickAid ticket <b>{ticket_id}</b> has been received "
                f"and is now <b>Open</b>.</p>"
                f"<p><b>Title:</b> {title}<br/>"
                f"<b>Category:</b> {category}</p>"
                f"<p>Our team will review it shortly. You can check the status "
                f"at any time using the QuickAid portal.</p>"
                f"<p>— The QuickAid Team</p>"
            ),
        )
        response = SendGridAPIClient(sendgrid_key).send(message)
        logging.info(
            "Confirmation email queued for ticket %s to %s (status=%s).",
            ticket_id,
            to_email,
            response.status_code,
        )
    except Exception as exc:
        logging.error(
            "SendGrid send failed for ticket %s -> %s: %s",
            ticket_id,
            to_email,
            exc,
        )


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

    # ── Connect to Cosmos DB (key sourced from Key Vault when configured) ───
    try:
        cosmos_key = get_secret("CosmosPrimaryKey", env_fallback="COSMOS_KEY")
    except RuntimeError as exc:
        logging.error("Cosmos credential unavailable: %s", exc)
        return func.HttpResponse(
            json.dumps({"error": "Server configuration error."}),
            status_code=500,
            mimetype="application/json"
        )

    client    = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
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

    # ── Send confirmation email (non-blocking on failure) ────────────────────
    _send_confirmation_email(
        to_email=email,
        ticket_id=ticket_id,
        title=title,
        category=category,
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
