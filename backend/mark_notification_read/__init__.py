import azure.functions as func
import logging
import json
import os
from azure.cosmos import CosmosClient, exceptions

from shared.secrets import get_secret


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("mark_notification_read function triggered.")

    # ── Get notification ID from route ───────────────────────────────────────
    notification_id = req.route_params.get("notificationId", "").strip()
    if not notification_id:
        return func.HttpResponse(
            json.dumps({"error": "notificationId is required in the URL."}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Parse request body ───────────────────────────────────────────────────
    try:
        body = req.get_json()
    except ValueError:
        body = {}

    # ── Get email to verify ownership ────────────────────────────────────────
    email = body.get("email", "").strip().lower()
    if not email:
        return func.HttpResponse(
            json.dumps({"error": "Email is required in the request body."}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Connect to Cosmos DB ─────────────────────────────────────────────────
    try:
        cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
        client = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
        database = client.get_database_client(os.environ["COSMOS_DATABASE"])
        container = database.get_container_client(os.environ["COSMOS_CONTAINER"])

        # ── Find the notification ────────────────────────────────────────────
        find_query = "SELECT * FROM c WHERE c.type = 'notification' AND c.id = @notificationId"
        find_params = [{"name": "@notificationId", "value": notification_id}]
        results = list(container.query_items(
            query=find_query,
            parameters=find_params,
            enable_cross_partition_query=True
        ))

        if not results:
            return func.HttpResponse(
                json.dumps({"error": f"Notification '{notification_id}' not found."}),
                status_code=404,
                mimetype="application/json"
            )

        notification = results[0]

        # ── Verify ownership ─────────────────────────────────────────────────
        if notification.get("recipient_email", "").lower() != email:
            return func.HttpResponse(
                json.dumps({"error": "Unauthorized. You can only mark your own notifications as read."}),
                status_code=403,
                mimetype="application/json"
            )

        # ── Mark as read ────────────────────────────────────────────────────
        notification["read"] = True

        # ── Save updated notification ────────────────────────────────────────
        container.replace_item(item=notification["id"], body=notification)

    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to update notification. Please try again later."}),
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
    clean_notification = {k: v for k, v in notification.items() if k not in cosmos_internal}

    # ── Success ──────────────────────────────────────────────────────────────
    return func.HttpResponse(
        json.dumps({
            "message": "Notification marked as read.",
            "notification": clean_notification
        }),
        status_code=200,
        mimetype="application/json"
    )
