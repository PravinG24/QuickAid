import azure.functions as func
import logging
import json
import hashlib
import hmac
import os
from azure.cosmos import CosmosClient

from shared.secrets import get_secret
from shared.jwt_utils import create_user_token


def hash_password(password: str) -> str:
    secret = get_secret("PasswordPepper", env_fallback="PASSWORD_SECRET")
    return hmac.new(secret.encode(), password.encode(), hashlib.sha256).hexdigest()


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("user_login function triggered.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body."}),
            status_code=400,
            mimetype="application/json",
        )

    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", "")).strip()
    if not email or not password:
        return func.HttpResponse(
            json.dumps({"error": "Email and password are required."}),
            status_code=400,
            mimetype="application/json",
        )

    cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
    client = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
    database = client.get_database_client(os.environ["COSMOS_DATABASE"])
    container = database.get_container_client(os.environ["COSMOS_CONTAINER"])

    query = "SELECT * FROM c WHERE c.type = 'user' AND c.email = @email"
    params = [{"name": "@email", "value": email}]
    users = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))

    if not users:
        return func.HttpResponse(
            json.dumps({"error": "Invalid email or password."}),
            status_code=401,
            mimetype="application/json",
        )

    user = users[0]
    stored_hash = user.get("passwordHash")
    if not stored_hash or stored_hash != hash_password(password):
        return func.HttpResponse(
            json.dumps({"error": "Invalid email or password."}),
            status_code=401,
            mimetype="application/json",
        )

    try:
        token = create_user_token(
            user_id=user.get("userId", user.get("id")),
            email=user["email"],
            name=user["name"],
        )
    except Exception as exc:
        logging.error("Failed to create JWT token: %s", exc)
        return func.HttpResponse(
            json.dumps({"error": "Failed to generate authentication token."}),
            status_code=500,
            mimetype="application/json",
        )

    return func.HttpResponse(
        json.dumps({
            "userId": user.get("userId", user.get("id")),
            "name": user.get("name"),
            "email": user.get("email"),
            "role": "user",
            "token": token,
        }),
        status_code=200,
        mimetype="application/json",
    )
