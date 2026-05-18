import azure.functions as func
import logging
import json
import os
import base64
import html
import threading
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, exceptions
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from shared.secrets import get_secret
from shared.activity_log import create_activity_log


def _resolve_sendgrid_api_key() -> str:
    for secret_name in ("SendGridApiKey", "SENDGRID-API-KEY"):
        try:
            return get_secret(secret_name, env_fallback="SENDGRID_API_KEY")
        except RuntimeError:
            continue
    raise RuntimeError("SENDGRID_API_KEY / SendGridApiKey is not configured.")


def _resolve_sendgrid_from_email() -> str:
    for env_name in ("SENDGRID_FROM_EMAIL", "SENDER_EMAIL"):
        value = os.environ.get(env_name, "").strip()
        if value:
            return value
    raise RuntimeError("SENDGRID_FROM_EMAIL is not configured.")


def _resolve_admin_notification_email() -> str:
    for env_name in ("SENDGRID_ADMIN_EMAIL", "ADMIN_EMAIL", "ENTRA_BOOTSTRAP_ADMIN_EMAIL"):
        value = os.environ.get(env_name, "").strip().lower()
        if value:
            return value
    return ""


def _send_email(recipient_email: str, subject: str, html_body: str) -> bool:
    """Send a single SendGrid email and log any failure."""
    try:
        api_key = _resolve_sendgrid_api_key()
        from_email = _resolve_sendgrid_from_email()

        message = Mail(
            from_email=from_email,
            to_emails=recipient_email,
            subject=subject,
            html_content=html_body,
        )

        response = SendGridAPIClient(api_key).send(message)
        logging.info(
            "SendGrid response for %s: status=%s body=%s",
            recipient_email,
            getattr(response, "status_code", None),
            getattr(response, "body", b"")
        )
        if getattr(response, "status_code", None) not in (200, 201, 202):
            raise RuntimeError(
                f"SendGrid returned status {getattr(response, 'status_code', None)}"
            )
        return True
    except Exception as exc:
        logging.error("Failed to send SendGrid email to %s: %s", recipient_email, exc)
        return False


def _resolve_sendgrid_api_key() -> str:
    for secret_name in ("SendGridApiKey", "SENDGRID-API-KEY"):
        try:
            return get_secret(secret_name, env_fallback="SENDGRID_API_KEY")
        except RuntimeError:
            continue
    raise RuntimeError("SENDGRID_API_KEY / SendGridApiKey is not configured.")


def _resolve_sendgrid_from_email() -> str:
    for env_name in ("SENDGRID_FROM_EMAIL", "SENDER_EMAIL"):
        value = os.environ.get(env_name, "").strip()
        if value:
            return value
    raise RuntimeError("SENDGRID_FROM_EMAIL is not configured.")


def _resolve_admin_notification_email() -> str:
    for env_name in ("SENDGRID_ADMIN_EMAIL", "ADMIN_EMAIL", "ENTRA_BOOTSTRAP_ADMIN_EMAIL"):
        value = os.environ.get(env_name, "").strip().lower()
        if value:
            return value
    return ""


def _send_email(recipient_email: str, subject: str, html_body: str) -> bool:
    """Send a single SendGrid email and log any failure."""
    try:
        api_key = _resolve_sendgrid_api_key()
        from_email = _resolve_sendgrid_from_email()

        message = Mail(
            from_email=from_email,
            to_emails=recipient_email,
            subject=subject,
            html_content=html_body,
        )

        response = SendGridAPIClient(api_key).send(message)
        logging.info(
            "SendGrid response for %s: status=%s body=%s",
            recipient_email,
            getattr(response, "status_code", None),
            getattr(response, "body", b"")
        )
        if getattr(response, "status_code", None) not in (200, 201, 202):
            raise RuntimeError(
                f"SendGrid returned status {getattr(response, 'status_code', None)}"
            )
        return True
    except Exception as exc:
        logging.error("Failed to send SendGrid email to %s: %s", recipient_email, exc)
        return False

    safe_admin_email = admin_email.strip().lower()
    safe_ticket_id = html.escape(ticket_id)
    safe_title = html.escape(title)
    safe_requester_name = html.escape(requester_name)
    safe_requester_email = html.escape(requester_email)
    safe_category = html.escape(category)
    safe_priority = html.escape(priority)
    safe_description = html.escape(description).replace("\n", "<br>")

    return _send_email(
        safe_admin_email,
        f"New Ticket Submitted: {title}",
        f"""
            <html>
              <body style="font-family: Arial, sans-serif; color: #1f2937;">
                <h2>New ticket submitted</h2>
                <p>A new ticket has been created in QuickAid.</p>
                <p><strong>Ticket ID:</strong> {safe_ticket_id}</p>
                <p><strong>Subject:</strong> {safe_title}</p>
                <p><strong>Requester:</strong> {safe_requester_name} ({safe_requester_email})</p>
                <p><strong>Category:</strong> {safe_category}</p>
                <p><strong>Priority:</strong> {safe_priority}</p>
                <p><strong>Description:</strong><br>{safe_description}</p>
              </body>
            </html>
        """,
    )


def _queue_notification_send(send_fn, *args) -> None:
    """Fire-and-forget email send so ticket creation does not block on SendGrid."""

    def _runner() -> None:
        try:
            send_fn(*args)
        except Exception as exc:
            logging.error("Background notification dispatch failed: %s", exc)

    thread = threading.Thread(target=_runner, daemon=True)
    thread.start()


def send_confirmation_email(email: str, ticket_id: str, title: str, requester_name: str) -> bool:
    """Send ticket submission confirmation email via SendGrid."""
    safe_requester_name = html.escape(requester_name)
    safe_ticket_id = html.escape(ticket_id)
    safe_title = html.escape(title)

    return _send_email(
        email,
        f"Ticket Received: {title}",
        f"""
            <html>
              <body style="font-family: Arial, sans-serif; color: #1f2937;">
                <h2>Thank you for submitting a support ticket</h2>
                <p>Hi {safe_requester_name},</p>
                <p>Your ticket has been submitted successfully.</p>
                <p><strong>Ticket ID:</strong> {safe_ticket_id}</p>
                <p><strong>Subject:</strong> {safe_title}</p>
                <p>We will review your request and respond as soon as possible.</p>
                <p>QuickAid Support Team</p>
              </body>
            </html>
        """,
    )


def send_admin_notification(admin_email: str, ticket_id: str, title: str, requester_name: str, requester_email: str, category: str, priority: str, description: str) -> bool:
    """Notify the support admin when a new ticket is created."""
    if not admin_email:
        logging.warning("No admin notification email configured; skipping admin alert for %s.", ticket_id)
        return False

    safe_admin_email = admin_email.strip().lower()
    safe_ticket_id = html.escape(ticket_id)
    safe_title = html.escape(title)
    safe_requester_name = html.escape(requester_name)
    safe_requester_email = html.escape(requester_email)
    safe_category = html.escape(category)
    safe_priority = html.escape(priority)
    safe_description = html.escape(description).replace("\n", "<br>")

    return _send_email(
        safe_admin_email,
        f"New Ticket Submitted: {title}",
        f"""
            <html>
              <body style="font-family: Arial, sans-serif; color: #1f2937;">
                <h2>New ticket submitted</h2>
                <p>A new ticket has been created in QuickAid.</p>
                <p><strong>Ticket ID:</strong> {safe_ticket_id}</p>
                <p><strong>Subject:</strong> {safe_title}</p>
                <p><strong>Requester:</strong> {safe_requester_name} ({safe_requester_email})</p>
                <p><strong>Category:</strong> {safe_category}</p>
                <p><strong>Priority:</strong> {safe_priority}</p>
                <p><strong>Description:</strong><br>{safe_description}</p>
              </body>
            </html>
        """,
    )


def _queue_notification_send(send_fn, *args) -> None:
    """Fire-and-forget email send so ticket creation does not block on SendGrid."""

    def _runner() -> None:
        try:
            send_fn(*args)
        except Exception as exc:
            logging.error("Background notification dispatch failed: %s", exc)

    thread = threading.Thread(target=_runner, daemon=True)
    thread.start()


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("submit_ticket function triggered.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body."}),
            status_code=400,
            mimetype="application/json",
        )

    required_fields = ["email", "title", "description", "category"]
    missing = [field for field in required_fields if not str(body.get(field, "")).strip()]
    if missing:
        return func.HttpResponse(
            json.dumps({"error": f"Missing required fields: {', '.join(missing)}"}),
            status_code=400,
            mimetype="application/json",
        )

    email = body["email"].strip().lower()
    title = body["title"].strip()
    description = body["description"].strip()
    category = body["category"].strip()
    requester_name = str(body.get("name", "")).strip() or "Requester"
    priority = str(body.get("priority", "")).strip()
    location = str(body.get("location", "")).strip() or None
    department = str(body.get("department", "")).strip() or None

    allowed_categories = ["IT", "HR", "Finance", "Operations", "General"]
    if category not in allowed_categories:
        return func.HttpResponse(
            json.dumps({"error": f"Invalid category. Allowed values: {', '.join(allowed_categories)}"}),
            status_code=400,
            mimetype="application/json",
        )

    allowed_priorities = ["Low", "Medium", "High"]
    if priority and priority not in allowed_priorities:
        priority = ""

    image_data = None
    image_filename = None
    image_mimetype = None

    if body.get("image"):
        try:
            image_info = body["image"]
            if not isinstance(image_info, dict):
                raise ValueError("Image must be an object.")

            image_filename = str(image_info.get("filename", "")).strip()
            image_mimetype = str(image_info.get("mimetype", "")).strip()
            image_base64 = str(image_info.get("data", "")).strip()

            if not image_filename or not image_mimetype or not image_base64:
                raise ValueError("Image must include filename, mimetype and data.")

            allowed_mimetypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
            if image_mimetype not in allowed_mimetypes:
                return func.HttpResponse(
                    json.dumps({"error": "Invalid image type. Allowed types: jpeg, png, gif, webp"}),
                    status_code=400,
                    mimetype="application/json",
                )

            base64.b64decode(image_base64, validate=True)
            if len(base64.b64decode(image_base64)) > 1 * 1024 * 1024:
                return func.HttpResponse(
                    json.dumps({"error": "Image size must be less than 1MB."}),
                    status_code=400,
                    mimetype="application/json",
                )

            image_data = image_base64
        except Exception:
            return func.HttpResponse(
                json.dumps({"error": "Invalid image data. Must be a valid base64 encoded string."}),
                status_code=400,
                mimetype="application/json",
            )

    cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
    client = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
    database = client.get_database_client(os.environ["COSMOS_DATABASE"])
    container = database.get_container_client(os.environ["COSMOS_CONTAINER"])

    count_query = "SELECT VALUE COUNT(1) FROM c WHERE c.type = 'ticket'"
    count_result = list(container.query_items(query=count_query, enable_cross_partition_query=True))
    count = count_result[0] if count_result else 0
    ticket_id = f"TCKT-{str(count + 1).zfill(2)}"

    now = datetime.now(timezone.utc)
    ticket = {
        "id": ticket_id,
        "ticketId": ticket_id,
        "type": "ticket",
        "email": email,
        "requesterName": requester_name,
        "title": title,
        "description": description,
        "category": category,
        "priority": priority,
        "location": location,
        "department": department,
        "status": "Open",
        "isUpdated": False,
        "hasImage": image_data is not None,
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat(),
        "timeline": [
            {
                "label": "Ticket created",
                "by": requester_name,
                "at": now.isoformat(),
            }
        ],
    }

    if image_data:
        ticket["image"] = {
            "filename": image_filename,
            "mimetype": image_mimetype,
            "data": image_data,
        }

    try:
        container.create_item(body=ticket)
    except exceptions.CosmosResourceExistsError:
        return func.HttpResponse(
            json.dumps({"error": "Ticket ID conflict. Please try again."}),
            status_code=409,
            mimetype="application/json",
        )
    except exceptions.CosmosHttpResponseError as exc:
        logging.error("Cosmos DB error: %s", exc)
        return func.HttpResponse(
            json.dumps({"error": "Failed to save ticket. Please try again later."}),
            status_code=500,
            mimetype="application/json",
        )
    except Exception as exc:
        logging.error("Unexpected error: %s", exc)
        return func.HttpResponse(
            json.dumps({"error": "An unexpected error occurred."}),
            status_code=500,
            mimetype="application/json",
        )

    admin_email = _resolve_admin_notification_email()
    _queue_notification_send(send_confirmation_email, email, ticket_id, title, requester_name)
    if admin_email and admin_email != email:
        _queue_notification_send(
            send_admin_notification,
            admin_email,
            ticket_id,
            title,
            requester_name,
            email,
            category,
            priority,
            description,
        )

    # ── Log activity ─────────────────────────────────────────────────────────
    create_activity_log(
        actor_email=email,
        actor_type="user",
        action="submitted_ticket",
        ticket_id=ticket_id,
        updated_fields={
            "title": title,
            "category": category,
            "priority": priority
        }
    )

    return func.HttpResponse(
        json.dumps({
            "message": "Ticket submitted successfully.",
            "ticketId": ticket_id,
            "type": "ticket",
            "status": "Open",
            "priority": priority,
            "hasImage": image_data is not None,
            "createdAt": now.isoformat(),
        }),
        status_code=201,
        mimetype="application/json",
    )
