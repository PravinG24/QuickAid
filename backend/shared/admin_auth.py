"""Admin authorization helpers for QuickAid.

This module supports a transition period where admin-only endpoints can
accept either:

1. Microsoft Entra ID access tokens with an admin app role claim.
2. The existing legacy JWT issued by the app's admin_login endpoint.

Set ADMIN_AUTH_MODE to:
- "mixed" to allow both token types during migration.
- "entra" to require Microsoft Entra ID tokens only.
- "legacy" to require the existing app-issued JWT only.
"""

from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from typing import Any, Dict, Optional, Tuple
from urllib.request import urlopen

import jwt

from shared.jwt_utils import verify_token as verify_legacy_token


def _normalize_mode() -> str:
    return str(os.environ.get("ADMIN_AUTH_MODE", "mixed")).strip().lower() or "mixed"


def _extract_bearer_token(req) -> str:
    auth_header = req.headers.get("Authorization", "") or req.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()

    token = req.params.get("token", "").strip()
    if token:
        return token

    return ""


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


def _verify_entra_token(token: str) -> Optional[Dict[str, Any]]:
    audience = str(os.environ.get("ENTRA_AUDIENCE", "")).strip()
    if not audience:
        raise RuntimeError("ENTRA_AUDIENCE is not configured.")

    required_role = str(os.environ.get("ENTRA_REQUIRED_ROLE", "Admin")).strip() or "Admin"
    metadata = _entra_metadata()
    jwks_uri = metadata.get("jwks_uri")
    issuer = metadata.get("issuer")

    if not jwks_uri or not issuer:
        raise RuntimeError("Invalid Entra OpenID metadata.")

    jwk_client = jwt.PyJWKClient(jwks_uri)
    signing_key = jwk_client.get_signing_key_from_jwt(token)

    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=audience,
        issuer=issuer,
    )

    roles = payload.get("roles") or []
    if isinstance(roles, str):
        roles = [roles]

    if required_role not in roles:
        return None

    return payload


def authorize_admin_request(req) -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[str]]:
    """Authorize an admin request.

    Returns a tuple of (payload, auth_type, error_message). If authorization
    fails, payload and auth_type are None and error_message contains a short
    reason for the caller to return.
    """
    token = _extract_bearer_token(req)
    if not token:
        return None, None, "Missing bearer token."

    mode = _normalize_mode()

    if mode in {"mixed", "legacy"}:
        legacy_payload = verify_legacy_token(token)
        if legacy_payload and str(legacy_payload.get("role", "")).lower() == "admin":
            return legacy_payload, "legacy", None

    if mode in {"mixed", "entra"}:
        try:
            entra_payload = _verify_entra_token(token)
        except Exception as exc:
            logging.warning("Entra token validation failed: %s", exc)
            entra_payload = None

        if entra_payload:
            return entra_payload, "entra", None

    if mode == "legacy":
        return None, None, "Invalid or expired admin token."

    if mode == "entra":
        return None, None, "Invalid Entra admin token or missing required role."

    return None, None, "Invalid admin token."