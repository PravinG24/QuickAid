import azure.functions as func
import logging
import json

from shared.notifications import mark_notification_as_read, mark_all_notifications_as_read


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("mark_notification_read function triggered.")

    # ── Get notification ID from route ───────────────────────────────────────
    notification_id = req.route_params.get("notificationId", "").strip()
    
    # ── Special case: mark all as read ───────────────────────────────────────
    if notification_id == "all":
        # ── Get email parameter ──────────────────────────────────────────────
        email = req.params.get("email", "").strip()
        if not email:
            return func.HttpResponse(
                json.dumps({"error": "email parameter is required when marking all as read."}),
                status_code=400,
                mimetype="application/json"
            )

        try:
            success = mark_all_notifications_as_read(email)
            if success:
                return func.HttpResponse(
                    json.dumps({
                        "message": "All notifications marked as read.",
                        "email": email
                    }),
                    status_code=200,
                    mimetype="application/json"
                )
            else:
                return func.HttpResponse(
                    json.dumps({"error": "Failed to mark notifications as read."}),
                    status_code=500,
                    mimetype="application/json"
                )
        except Exception as e:
            logging.error("Error marking all notifications as read: %s", e)
            return func.HttpResponse(
                json.dumps({"error": "An error occurred."}),
                status_code=500,
                mimetype="application/json"
            )

    # ── Mark specific notification as read ────────────────────────────────────
    if not notification_id:
        return func.HttpResponse(
            json.dumps({"error": "notificationId is required in the URL."}),
            status_code=400,
            mimetype="application/json"
        )

    try:
        updated_notification = mark_notification_as_read(notification_id)
        
        if not updated_notification:
            return func.HttpResponse(
                json.dumps({"error": f"Notification '{notification_id}' not found."}),
                status_code=404,
                mimetype="application/json"
            )
        
        return func.HttpResponse(
            json.dumps({
                "message": "Notification marked as read.",
                "notification": updated_notification
            }),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        logging.error("Error marking notification as read: %s", e)
        return func.HttpResponse(
            json.dumps({"error": "Failed to update notification. Please try again later."}),
            status_code=500,
            mimetype="application/json"
        )
