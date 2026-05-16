import azure.functions as func
import logging
import json
import os
from azure.cosmos import CosmosClient, exceptions

from shared.secrets import get_secret
from shared.admin_auth import authorize_admin_request


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("delete_ticket function triggered.")

    payload, auth_type, error_message = authorize_admin_request(req)
    if not payload:
        return func.HttpResponse(
            json.dumps({"error": error_message or "Unauthorized."}),
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

        # Delete by id (partition handling is left to the container configuration)
        container.delete_item(item=ticket["id"])

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
