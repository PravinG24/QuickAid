import azure.functions as func
import logging
import json
import os
from azure.cosmos import CosmosClient, exceptions

from shared.secrets import get_secret
from shared.admin_auth import _extract_bearer_token
from shared.jwt_utils import verify_token
from shared.activity_log import create_activity_log


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("delete_ticket function triggered.")

    # Verify user JWT (or admin token) and ensure requester owns the ticket.
    token = _extract_bearer_token(req)
    if not token:
        return func.HttpResponse(
            json.dumps({"error": "Missing bearer token."}),
            status_code=401,
            mimetype="application/json",
        )

    user_claims = verify_token(token)
    if not user_claims:
        # token invalid or expired
        return func.HttpResponse(
            json.dumps({"error": "Invalid or expired token."}),
            status_code=401,
            mimetype="application/json",
        )

    ticket_id = req.route_params.get("ticketId", "").strip()
    if not ticket_id:
        return func.HttpResponse(
            json.dumps({"error": "ticketId is required in the URL."}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
        client = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
        database = client.get_database_client(os.environ["COSMOS_DATABASE"])
        container = database.get_container_client(os.environ["COSMOS_CONTAINER"])

        find_query = "SELECT * FROM c WHERE c.type = 'ticket' AND (c.id = @ticketId OR c.ticketId = @ticketId)"
        results = list(
            container.query_items(
                query=find_query,
                parameters=[{"name": "@ticketId", "value": ticket_id}],
                enable_cross_partition_query=True,
            )
        )

        if not results:
            return func.HttpResponse(
                json.dumps({"error": f"Ticket '{ticket_id}' not found."}),
                status_code=404,
                mimetype="application/json",
            )

        ticket = results[0]

        # Authorization: allow deletion when the authenticated user is the
        # ticket owner (matching email) or when the token indicates admin role.
        token_email = str(user_claims.get("email") or user_claims.get("preferred_username") or "").strip().lower()
        token_role = str(user_claims.get("role") or "").strip().lower()
        ticket_email = str(ticket.get("email") or ticket.get("requesterName") or "").strip().lower()

        if token_role != "admin" and token_email and ticket.get("email") and token_email != ticket.get("email", "").strip().lower():
            return func.HttpResponse(
                json.dumps({"error": "Forbidden: you are not authorized to delete this ticket."}),
                status_code=403,
                mimetype="application/json",
            )

        # Delete by id (partition handling is left to the container configuration)
        container.delete_item(item=ticket["id"], partition_key=ticket["type"])

        #── Log activity ─────────────────────────────────────────────────────
        create_activity_log(
            actor_email=token_email,
            actor_type=token_role,
            action="deleted_ticket",
            ticket_id=ticket_id,
            old_values={
                "title": ticket.get("title"),
                "status": ticket.get("status")
            }
        )

    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to delete ticket. Please try again later."}),
            status_code=500,
            mimetype="application/json",
        )
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "An unexpected error occurred."}),
            status_code=500,
            mimetype="application/json",
        )

    # Successful delete — no content
    return func.HttpResponse(status_code=204)
