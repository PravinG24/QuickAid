import azure.functions as func
import logging
import json
import os
import base64
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

    # ── Handle optional image ────────────────────────────────────────────────
    image_data     = None
    image_filename = None
    image_mimetype = None

    if "image" in body and body["image"]:
        try:
            image_info = body["image"]

            # Validate required image fields
            if not isinstance(image_info, dict):
                return func.HttpResponse(
                    json.dumps({"error": "Image must be an object with 'filename', 'mimetype' and 'data' fields."}),
                    status_code=400,
                    mimetype="application/json"
                )

            image_filename = image_info.get("filename", "").strip()
            image_mimetype = image_info.get("mimetype", "").strip()
            image_base64   = image_info.get("data", "").strip()

            if not image_filename or not image_mimetype or not image_base64:
                return func.HttpResponse(
                    json.dumps({"error": "Image must include 'filename', 'mimetype' and 'data' fields."}),
                    status_code=400,
                    mimetype="application/json"
                )

            # Validate mimetype
            allowed_mimetypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
            if image_mimetype not in allowed_mimetypes:
                return func.HttpResponse(
                    json.dumps({"error": f"Invalid image type. Allowed types: jpeg, png, gif, webp"}),
                    status_code=400,
                    mimetype="application/json"
                )

            # Validate base64
            base64.b64decode(image_base64, validate=True)

            # Validate image size (max 1MB after base64 decode)
            image_bytes = base64.b64decode(image_base64)
            max_size    = 1 * 1024 * 1024  # 1MB
            if len(image_bytes) > max_size:
                return func.HttpResponse(
                    json.dumps({"error": "Image size must be less than 1MB."}),
                    status_code=400,
                    mimetype="application/json"
                )

            image_data = image_base64

        except Exception:
            return func.HttpResponse(
                json.dumps({"error": "Invalid image data. Must be a valid base64 encoded string."}),
                status_code=400,
                mimetype="application/json"
            )

    # ── Connect to Cosmos DB ─────────────────────────────────────────────────
    client    = CosmosClient.from_connection_string(os.environ["COSMOS_CONNECTION_STRING"])
    database  = client.get_database_client(os.environ["COSMOS_DATABASE_NAME"])
    container = database.get_container_client(os.environ["COSMOS_CONTAINER_NAME"])

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
        "priority":    "Low",           # ← default priority
        "hasImage":    image_data is not None,
        "createdAt":   now.isoformat(),
        "updatedAt":   now.isoformat(),
    }

    # ── Add image if provided ────────────────────────────────────────────────
    if image_data:
        ticket["image"] = {
            "filename": image_filename,
            "mimetype": image_mimetype,
            "data":     image_data      # base64 encoded
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
            "priority":  "Low",
            "hasImage":  image_data is not None,
            "createdAt": now.isoformat()
        }),
        status_code=201,
        mimetype="application/json"
    )