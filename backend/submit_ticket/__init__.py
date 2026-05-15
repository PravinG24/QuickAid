import azure.functions as func
import logging
import json
import os
import base64
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, exceptions
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from shared.secrets import get_secret


def send_confirmation_email(email: str, ticket_id: str, title: str, requester_name: str) -> bool:
    """Send ticket submission confirmation email via SendGrid."""
    try:
        api_key = get_secret("SENDGRID-API-KEY", env_fallback="SENDGRID_API_KEY")
        from_email = os.environ.get("SENDGRID_FROM_EMAIL", "")
        if not from_email:
            raise RuntimeError("SENDGRID_FROM_EMAIL is not configured.")

        message = Mail(
            from_email=from_email,
            to_emails=email,
            subject=f"Ticket Received: {title}",
            html_content=f"""
                <html>
                  <body style="font-family: Arial, sans-serif; color: #1f2937;">
                    <h2>Thank you for submitting a support ticket</h2>
                    <p>Hi {requester_name},</p>
                    <p>Your ticket has been submitted successfully.</p>
                    <p><strong>Ticket ID:</strong> {ticket_id}</p>
                    <p><strong>Subject:</strong> {title}</p>
                    <p>We will review your request and respond as soon as possible.</p>
                    <p>QuickAid Support Team</p>
                  </body>
                </html>
            """,
        )

        SendGridAPIClient(api_key).send(message)
        logging.info("Confirmation email sent to %s for ticket %s", email, ticket_id)
        return True
    except Exception as exc:
        logging.error("Failed to send confirmation email: %s", exc)
        return False


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
    priority = str(body.get("priority", "Medium")).strip() or "Medium"
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
    if priority not in allowed_priorities:
        priority = "Medium"

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
        "hasImage": image_data is not None,
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat(),
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

    send_confirmation_email(email, ticket_id, title, requester_name)

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
