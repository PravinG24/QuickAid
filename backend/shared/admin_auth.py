"""Admin authorization helpers for QuickAid.

This module enforces Microsoft Entra ID (Azure AD) access tokens for
admin-only endpoints. Legacy application-issued JWTs are also accepted
for the admin credential path.
"""

from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from typing import Any, Dict, Optional, Tuple
from urllib.request import urlopen

import jwt

from shared.secrets import get_secret


def _extract_bearer_token(req) -> str:
    auth_header = req.headers.get("Authorization", "") or req.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()

    token = req.params.get("token", "").strip()
    if token:
        return token

    return ""


def _get_entra_audience() -> str:
    audience = str(
        os.environ.get("ENTRA_AUDIENCE", "")
        or os.environ.get("ENTRA_API_AUDIENCE", "")
        or os.environ.get("QUICKAID_ENTRA_API_AUDIENCE", "")
    ).strip()
    if not audience:
        raise RuntimeError("ENTRA_AUDIENCE is not configured.")
    return audience


@lru_cache(maxsize=1)
def _entra_metadata() -> Dict[str, Any]:
    tenant_id = str(os.environ.get("ENTRA_TENANT_ID", "")).strip()
    if not tenant_id:
        raise RuntimeError("ENTRA_TENANT_ID is not configured.")

    metadata_url = (
        f"https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration"
    )
    with urlopen(metadata_url, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def _verify_entra_token(token: str, require_role: bool = True) -> Optional[Dict[str, Any]]:
    audience = _get_entra_audience()

    required_role = str(os.environ.get("ENTRA_REQUIRED_ROLE", "Admin")).strip() or "Admin"
    metadata = _entra_metadata()
    jwks_uri = metadata.get("jwks_uri")
    issuer = metadata.get("issuer")

    if not jwks_uri or not issuer:
        raise RuntimeError("Invalid Entra OpenID metadata.")

    jwk_client = jwt.PyJWKClient(jwks_uri)
    signing_key = jwk_client.get_signing_key_from_jwt(token)

    # Decode and validate token signature and audience, but perform a
    # flexible issuer check because tokens may be issued with either the
    # v2.0 issuer (login.microsoftonline.com/.../v2.0) or the legacy
    # sts.windows.net issuer. We also perform a case-insensitive role
    # comparison to avoid mismatches in role casing.
    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=audience,
        options={"verify_issuer": False},
    )

    # Optional verbose debug logging (disabled by default). To enable,
    # set `VERBOSE_AUTH_DEBUG=true` in the Function App settings (or local.settings).
    try:
        if str(os.environ.get("VERBOSE_AUTH_DEBUG", "")).lower() in {"1", "true", "yes"}:
            debug_claims = {
                "aud": payload.get("aud"),
                "iss": payload.get("iss"),
                "sub": payload.get("sub"),
                "upn": payload.get("upn") or payload.get("preferred_username") or payload.get("email"),
                "roles": payload.get("roles"),
            }
            logging.warning("[AuthDebug] decoded token claims: %s", debug_claims)
    except Exception:
        logging.exception("[AuthDebug] failed to emit debug claims")

    token_iss = str(payload.get("iss", "")).rstrip("/")
    tenant_id = str(os.environ.get("ENTRA_TENANT_ID", "")).strip()
    allowed_issuers = set()
    if issuer:
        allowed_issuers.add(str(issuer).rstrip("/"))
    if tenant_id:
        allowed_issuers.add(f"https://sts.windows.net/{tenant_id}")

    if token_iss not in allowed_issuers:
        logging.warning("Entra token issuer mismatch. token_iss=%s allowed=%s", token_iss, allowed_issuers)
        return None

    if require_role:
        roles = payload.get("roles") or []
        if isinstance(roles, str):
            roles = [roles]

        norm_roles = [str(r).lower() for r in roles if r]
        if required_role.lower() not in norm_roles:
            logging.warning("Entra token missing required role. required=%s roles=%s", required_role, norm_roles)
            return None

    return payload


def _verify_admin_app_token(token: str) -> Optional[Dict[str, Any]]:
    secret = get_secret("JWT-SECRET", env_fallback="JWT_SECRET")
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None

    role = str(payload.get("role") or "").strip().lower()
    if role != "admin":
        return None

    return payload


def _is_approved_admin(email: str) -> bool:
    normalized_email = str(email or "").strip().lower()
    if not normalized_email:
        return False

    from shared.admin_approvals import get_container, find_admin_request_by_email, get_bootstrap_admin_email

    if normalized_email == get_bootstrap_admin_email():
        return True

    container = get_container()
    request = find_admin_request_by_email(container, normalized_email)
    if not request:
        logging.warning("No admin approval record found for %s", normalized_email)
        return False

    status = str(request.get("approvalStatus") or request.get("status") or "").strip().lower()
    if status not in {"approved", "active"}:
        logging.warning("Admin approval not granted for %s status=%s", normalized_email, status)
        return False

    return True


def authorize_admin_request(req) -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[str]]:
    """Authorize an admin request using Microsoft Entra ID tokens.

    Returns (payload, auth_type, error_message). On success payload is the
    decoded token and auth_type is either "app" or "entra". On failure
    payload and auth_type are None and error_message explains the reason.
    """
    token = _extract_bearer_token(req)
    if not token:
        return None, None, "Missing bearer token."

    admin_app_payload = _verify_admin_app_token(token)
    if admin_app_payload:
        email = str(
            admin_app_payload.get("email")
            or admin_app_payload.get("preferred_username")
            or admin_app_payload.get("upn")
            or ""
        ).strip().lower()
        if not _is_approved_admin(email):
            return None, None, "Your admin request is pending approval."
        return admin_app_payload, "app", None

    try:
        entra_payload = _verify_entra_token(token, require_role=True)
    except Exception as exc:
        logging.warning("Entra token validation failed: %s", exc)
        return None, None, "Invalid Entra admin token or missing required role."

    if not entra_payload:
        return None, None, "Invalid Entra admin token or missing required role."

    email = str(
        entra_payload.get("preferred_username")
        or entra_payload.get("email")
        or entra_payload.get("upn")
        or ""
    ).strip().lower()
    if not _is_approved_admin(email):
        return None, None, "Your admin request is pending approval."

    return entra_payload, "entra", None