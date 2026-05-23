import azure.functions as func
import logging
import json
import hashlib
import hmac
import os
from azure.cosmos import CosmosClient

from shared.admin_approvals import find_admin_request_by_email, get_bootstrap_admin_email
from shared.jwt_utils import create_admin_token
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

    approval_status = str(admin.get("approvalStatus") or admin.get("status") or "").strip().lower()
    bootstrap_email = get_bootstrap_admin_email()
    approved = approval_status in {"approved", "active"} or email == bootstrap_email
    if not approved:
        request = find_admin_request_by_email(container, email)
        approval_status = str(
            (request or {}).get("approvalStatus") or (request or {}).get("status") or approval_status
        ).strip().lower()
        approved = approval_status in {"approved", "active"} or email == bootstrap_email

    if not approved:
        if approval_status == "rejected":
            return func.HttpResponse(
                json.dumps({"error": "Your admin request was rejected. Contact the system admin."}),
                status_code=403,
                mimetype="application/json",
            )
        return func.HttpResponse(
            json.dumps({"error": "Your admin request is still pending approval."}),
            status_code=403,
            mimetype="application/json",
        )

    token = create_admin_token(
        admin_id=admin.get("adminId", admin.get("id", email)),
        email=email,
        name=admin.get("name", email),
    )

    return func.HttpResponse(
        json.dumps({
            "adminId": admin.get("adminId", admin.get("id", email)),
            "name": admin.get("name"),
            "email": email,
            "role": "admin",
            "token": token,
            "provider": "admin_credentials",
            "approvalStatus": approval_status or "approved",
        }),
        status_code=200,
        mimetype="application/json",
    )
