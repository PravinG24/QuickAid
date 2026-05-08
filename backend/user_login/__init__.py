import azure.functions as func
import logging
import json
import hashlib
import hmac
import os
from azure.cosmos import CosmosClient

# ── Helper: hash password ────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    secret = os.environ.get("PASSWORD_SECRET", "quickaid-secret-key")
    hashed = hmac.new(secret.encode(), password.encode(), hashlib.sha256)
    return hashed.hexdigest()

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("user_login function triggered.")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body."}),
            status_code=400,
            mimetype="application/json"
        )

    email    = body.get("email", "").strip().lower()
    password = body.get("password", "").strip()

    if not email or not password:
        return func.HttpResponse(
            json.dumps({"error": "Email and password are required."}),
            status_code=400,
            mimetype="application/json"
        )

    client    = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=os.environ["COSMOS_KEY"])
    database  = client.get_database_client(os.environ["COSMOS_DATABASE"])
    container = database.get_container_client(os.environ["COSMOS_CONTAINER"])

    # ── Find user by email ───────────────────────────────────────────────────
    query  = "SELECT * FROM c WHERE c.type = 'user' AND c.email = @email"
    params = [{"name": "@email", "value": email}]
    users = list(container.query_items(
        query=query,
        parameters=params,
        enable_cross_partition_query=True
    ))

    if not users:
        return func.HttpResponse(
            json.dumps({"error": "Invalid email or password."}),
            status_code=401,
            mimetype="application/json"
        )

    user = users[0]
    stored_hash = user.get("passwordHash")

    if stored_hash != hash_password(password):
        return func.HttpResponse(
            json.dumps({"error": "Invalid email or password."}),
            status_code=401,
            mimetype="application/json"
        )

    # ── Success ──────────────────────────────────────────────────────────────
    return func.HttpResponse(
        json.dumps({
            "message": "Login successful.",
            "userId": user.get("userId"),
            "name":   user.get("name"),
            "email":  user.get("email"),
            "role":   user.get("role")
        }),
        status_code=200,
        mimetype="application/json"
    )
