import azure.functions as func
import logging
import json
import hashlib
import hmac
import os
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, exceptions

from shared.secrets import get_secret

# ── Helper: hash password ────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    secret = get_secret("PasswordPepper", env_fallback="PASSWORD_SECRET")
    hashed = hmac.new(secret.encode(), password.encode(), hashlib.sha256)
    return hashed.hexdigest()

# ── Helper: email format check ───────────────────────────────────────────────
def is_valid_email(email: str) -> bool:
    return "@" in email and "." in email.split("@")[-1]

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("register_admin function triggered.")

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
    required_fields = ["name", "email", "password"]
    missing = [f for f in required_fields if not body.get(f, "").strip()]
    if missing:
        return func.HttpResponse(
            json.dumps({"error": f"Missing required fields: {', '.join(missing)}"}),
            status_code=400,
            mimetype="application/json"
        )

    name     = body["name"].strip()
    email    = body["email"].strip().lower()
    password = body["password"].strip()

    # ── Validate email ───────────────────────────────────────────────────────
    if not is_valid_email(email):
        return func.HttpResponse(
            json.dumps({"error": "Invalid email format."}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Validate password ────────────────────────────────────────────────────
    if len(password) < 8:
        return func.HttpResponse(
            json.dumps({"error": "Password must be at least 8 characters."}),
            status_code=400,
            mimetype="application/json"
        )

    # ── Connect to Cosmos DB ─────────────────────────────────────────────────
    cosmos_key = get_secret("COSMOS-KEY", env_fallback="COSMOS_KEY")
    client    = CosmosClient(url=os.environ["COSMOS_ENDPOINT"], credential=cosmos_key)
    database  = client.get_database_client(os.environ["COSMOS_DATABASE"])
    container = database.get_container_client(os.environ["COSMOS_CONTAINER"])

    # ── Check if email already registered ───────────────────────────────────
    check_query  = "SELECT * FROM c WHERE c.type = 'admin' AND c.email = @email"
    check_params = [{"name": "@email", "value": email}]
    existing = list(container.query_items(
        query=check_query,
        parameters=check_params,
        enable_cross_partition_query=True
    ))

    if existing:
        return func.HttpResponse(
            json.dumps({"error": "Email is already registered as admin."}),
            status_code=409,
            mimetype="application/json"
        )

    # ── Generate ADM-XX ID ───────────────────────────────────────────────────
    count_query  = "SELECT VALUE COUNT(1) FROM c WHERE c.type = 'admin'"
    count_result = list(container.query_items(
        query=count_query,
        enable_cross_partition_query=True
    ))
    count   = count_result[0] if count_result else 0
    admin_id = f"ADM-{str(count + 1).zfill(2)}"

    # ── Build admin document ─────────────────────────────────────────────────
    now  = datetime.now(timezone.utc)
    admin = {
        "id":           admin_id,
        "adminId":      admin_id,
        "type":         "admin",
        "name":         name,
        "email":        email,
        "passwordHash": hash_password(password),
        "role":         "admin",
        "createdAt":    now.isoformat(),
        "updatedAt":    now.isoformat(),
        "status":       "Active"
    }

    # ── Save to Cosmos DB ────────────────────────────────────────────────────
    try:
        container.create_item(body=admin)

    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to register admin. Please try again later."}),
            status_code=500,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "An unexpected error occurred."}),
            status_code=500,
            mimetype="application/json"
        )

    # ── Success ──────────────────────────────────────────────────────────────
    return func.HttpResponse(
        json.dumps({
            "message":   "Admin registered successfully.",
            "adminId":   admin_id,
            "name":      name,
            "email":     email,
            "role":      "admin",
            "createdAt": now.isoformat()
        }),
        status_code=201,
        mimetype="application/json"
    )
