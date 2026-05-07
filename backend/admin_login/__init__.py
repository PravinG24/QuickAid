import azure.functions as func
import logging
import json
import hashlib
import hmac
import os
from azure.cosmos import CosmosClient, exceptions

# ── Helper: hash password ────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    secret = os.environ.get("PASSWORD_SECRET", "quickaid-secret-key")
    hashed = hmac.new(secret.encode(), password.encode(), hashlib.sha256)
    return hashed.hexdigest()

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("admin_login function triggered.")

    # ── Parse request body ───────────────────────────────────────────────────
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body."}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Validate required fields ─────────────────────────────────────────────
    required_fields = ["email", "password"]
    missing = [f for f in required_fields if not body.get(f, "").strip()]
    if missing:
        return func.HttpResponse(
            json.dumps({"error": f"Missing required fields: {', '.join(missing)}"}),
            status_code=400,
            mimetype="application/json"
        )

    email    = body["email"].strip().lower()
    password = body["password"].strip()

    # ── Connect to Cosmos DB ─────────────────────────────────────────────────
    client    = CosmosClient.from_connection_string(os.environ["COSMOS_CONNECTION_STRING"])
    database  = client.get_database_client(os.environ["COSMOS_DATABASE_NAME"])
    container = database.get_container_client(os.environ["COSMOS_CONTAINER_NAME"])

    # ── Find admin by email ──────────────────────────────────────────────────
    query  = "SELECT * FROM c WHERE c.type = 'admin' AND c.email = @email"
    params = [{"name": "@email", "value": email}]
    admins = list(container.query_items(
        query=query,
        parameters=params,
        enable_cross_partition_query=True
    ))

    if not admins:
        return func.HttpResponse(
            json.dumps({"error": "Admin not found."}),
            status_code=404,
            mimetype="application/json"
        )

    admin = admins[0]

    # ── Verify password ──────────────────────────────────────────────────────
    if admin.get("passwordHash") != hash_password(password):
        return func.HttpResponse(
            json.dumps({"error": "Invalid credentials."}),
            status_code=401,
            mimetype="application/json"
        )

    # ── Success ──────────────────────────────────────────────────────────────
    return func.HttpResponse(
        json.dumps({
            "message":   "Login successful.",
            "adminId":   admin.get("adminId"),
            "name":      admin.get("name"),
            "email":     admin.get("email"),
            "role":      admin.get("role"),
            "status":    admin.get("status", "Active")
        }),
        status_code=200,
        mimetype="application/json"
    )
