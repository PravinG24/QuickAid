import azure.functions as func
import json
import logging

from shared.admin_auth import authorize_admin_request, _extract_bearer_token, _verify_entra_token
from shared.admin_approvals import get_container, list_admin_requests, find_admin_request_by_email, set_admin_request_status, get_bootstrap_admin_email


def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("admin_approvals function triggered.")

    mine_only = str(req.params.get("mine", "")).strip().lower() in {"1", "true", "yes"}
    status_filter = str(req.params.get("status", "")).strip() or None

    if req.method.lower() == "get":
        if mine_only:
            token = _extract_bearer_token(req)
            if not token:
                return func.HttpResponse(json.dumps({"error": "Missing bearer token."}), status_code=401, mimetype="application/json")
            try:
                payload = _verify_entra_token(token)
            except Exception as exc:
                logging.warning("Admin approval status lookup failed: %s", exc)
                return func.HttpResponse(json.dumps({"error": "Invalid admin token."}), status_code=401, mimetype="application/json")
            if not payload:
                return func.HttpResponse(json.dumps({"error": "Invalid admin token."}), status_code=401, mimetype="application/json")

            email = str(payload.get("preferred_username") or payload.get("email") or payload.get("upn") or "").strip().lower()
            if not email:
                return func.HttpResponse(json.dumps({"error": "Unable to resolve admin email."}), status_code=400, mimetype="application/json")

            container = get_container()
            request = find_admin_request_by_email(container, email)
            if not request:
                if email == get_bootstrap_admin_email():
                    return func.HttpResponse(json.dumps({"approvalStatus": "approved", "email": email, "bootstrap": True}), status_code=200, mimetype="application/json")
                return func.HttpResponse(json.dumps({"approvalStatus": "missing", "email": email}), status_code=200, mimetype="application/json")

            return func.HttpResponse(json.dumps({"request": request}), status_code=200, mimetype="application/json")

        payload, auth_type, error_message = authorize_admin_request(req)
        if not payload:
            return func.HttpResponse(json.dumps({"error": error_message or "Unauthorized."}), status_code=401, mimetype="application/json")

        container = get_container()
        requests = list_admin_requests(container, status_filter)
        return func.HttpResponse(
            json.dumps({
                "requests": requests,
                "count": len(requests),
            }),
            status_code=200,
            mimetype="application/json",
        )

    if req.method.lower() == "patch":
        payload, auth_type, error_message = authorize_admin_request(req)
        if not payload:
            return func.HttpResponse(json.dumps({"error": error_message or "Unauthorized."}), status_code=401, mimetype="application/json")

        try:
            body = req.get_json()
        except ValueError:
            return func.HttpResponse(json.dumps({"error": "Invalid JSON body."}), status_code=400, mimetype="application/json")

        admin_id = str(body.get("adminId", "") or body.get("id", "") or "").strip()
        next_status = str(body.get("status", "")).strip().lower()
        reviewed_by = str(body.get("reviewedBy", "")).strip() or str(payload.get("email") or payload.get("preferred_username") or "Admin")

        if not admin_id:
            return func.HttpResponse(json.dumps({"error": "adminId is required."}), status_code=400, mimetype="application/json")
        if next_status not in {"approved", "rejected"}:
            return func.HttpResponse(json.dumps({"error": "status must be approved or rejected."}), status_code=400, mimetype="application/json")

        container = get_container()
        updated = set_admin_request_status(container, admin_id, next_status, reviewed_by)
        if not updated:
            return func.HttpResponse(json.dumps({"error": f"Admin request '{admin_id}' not found."}), status_code=404, mimetype="application/json")

        return func.HttpResponse(json.dumps({"request": updated}), status_code=200, mimetype="application/json")

    return func.HttpResponse(json.dumps({"error": "Method not allowed."}), status_code=405, mimetype="application/json")
