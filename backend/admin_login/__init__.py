import azure.functions as func
import logging
import json
import hashlib
import hmac
import os
from azure.cosmos import CosmosClient

from shared.secrets import get_secret


def hash_password(password: str) -> str:
    secret = get_secret("PasswordPepper", env_fallback="PASSWORD_SECRET")
    return hmac.new(secret.encode(), password.encode(), hashlib.sha256).hexdigest()


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("admin_login function triggered.")

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

    query = "SELECT * FROM c WHERE c.type = 'admin' AND c.email = @email"
    params = [{"name": "@email", "value": email}]
    admins = list(container.query_items(query=query, parameters=params, enable_cross_partition_query=True))

    if not admins:
        return func.HttpResponse(
            json.dumps({"error": "Invalid email or password."}),
            status_code=401,
            mimetype="application/json",
        )

    admin = admins[0]
    stored_hash = admin.get("passwordHash")
    if not stored_hash or stored_hash != hash_password(password):
        return func.HttpResponse(
            json.dumps({"error": "Invalid email or password."}),
            status_code=401,
            mimetype="application/json",
        )

    # Legacy JWT issuance has been removed. Admins must authenticate via
    # Microsoft Entra ID (Azure AD). Return a clear 403 response so callers
    # know to switch to the Entra login flow.
    return func.HttpResponse(
        json.dumps({
            "error": "Admin login via application credentials is disabled. Use Microsoft Entra ID (Azure AD) to sign in.",
        }),
        status_code=403,
        mimetype="application/json",
    )
