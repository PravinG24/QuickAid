import azure.functions as func
import logging
import json

from shared.activity_log import get_activity_log_for_ticket


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("get_activity_log function triggered.")

    ticket_id = req.route_params.get("ticketId", "").strip()
    if not ticket_id:
        return func.HttpResponse(
            json.dumps({"error": "ticketId route parameter is required."}),
            status_code=400,
            mimetype="application/json"
        )

    try:
        logs = get_activity_log_for_ticket(ticket_id)

        return func.HttpResponse(
            json.dumps({
                "ticketId": ticket_id,
                "logs": logs,
                "totalCount": len(logs),
            }),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        logging.error("Failed to retrieve activity logs for ticket %s: %s", ticket_id, e)
        return func.HttpResponse(
            json.dumps({"error": "Failed to retrieve activity logs. Please try again later."}),
            status_code=500,
            mimetype="application/json"
        )
