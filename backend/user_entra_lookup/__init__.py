import azure.functions as func
import logging
import json
import os
from azure.cosmos import CosmosClient

from shared.secrets import get_secret
from shared.admin_auth import _extract_bearer_token


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("user_entra_lookup function triggered.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body."}),
            status_code=400,
            mimetype="application/json",
        )

    email = str(body.get("email", "")).strip().lower()
    if not email:
        return func.HttpResponse(
            json.dumps({"error": "Email is required."}),
            status_code=400,
            mimetype="application/json",
        )

    # Basic email format check
    if "@" not in email or "." not in email.split("@")[-1]:
        return func.HttpResponse(
            json.dumps({"error": "Invalid email format."}),
            status_code=400,
            mimetype="application/json",
        )

    # Connect to Cosmos DB
    cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
    client = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
    database = client.get_database_client(os.environ["COSMOS_DATABASE"])
    container = database.get_container_client(os.environ["COSMOS_CONTAINER"])

    # Query for existing student user record
    query = "SELECT * FROM c WHERE c.type = 'user' AND c.email = @email"
    params = [{"name": "@email", "value": email}]
    
    try:
        users = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
    except Exception as exc:
        logging.error(f"Cosmos DB query error: {exc}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to lookup user. Please try again later."}),
            status_code=500,
            mimetype="application/json",
        )

    if not users:
        return func.HttpResponse(
            json.dumps({
                "exists": False,
                "message": "Student not found. Please register first.",
            }),
            status_code=404,
            mimetype="application/json",
        )

    user = users[0]
    return func.HttpResponse(
        json.dumps({
            "exists": True,
            "userId": user.get("userId", user.get("id")),
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role", "user"),
        }),
        status_code=200,
        mimetype="application/json",
    )
