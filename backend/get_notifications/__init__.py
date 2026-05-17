import azure.functions as func
import logging
import json

from shared.notifications import get_notifications_for_user, get_unread_notification_count


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("get_notifications function triggered.")

    # ── Get email parameter ──────────────────────────────────────────────────
    email = req.params.get("email", "").strip()
    if not email:
        return func.HttpResponse(
            json.dumps({"error": "email parameter is required."}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Get optional filters ─────────────────────────────────────────────────
    unread_only = req.params.get("unread_only", "false").lower() in {"true", "1", "yes"}

    try:
        # ── Retrieve notifications ───────────────────────────────────────────
        notifications = get_notifications_for_user(email, include_read=not unread_only)
        unread_count = get_unread_notification_count(email)

        # ── Remove internal Cosmos fields ────────────────────────────────────
        cosmos_internal = {"_rid", "_self", "_etag", "_attachments", "_ts"}
        clean_notifications = [
            {k: v for k, v in notif.items() if k not in cosmos_internal}
            for notif in notifications
        ]

        return func.HttpResponse(
            json.dumps({
                "email": email,
                "notifications": clean_notifications,
                "unread_count": unread_count,
                "total_count": len(clean_notifications)
            }),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        logging.error("Error retrieving notifications: %s", e)
        return func.HttpResponse(
            json.dumps({"error": "Failed to retrieve notifications. Please try again later."}),
            status_code=500,
            mimetype="application/json"
        )
