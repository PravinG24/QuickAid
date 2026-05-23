"""JWT token utilities for QuickAid admin authentication."""

import jwt
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from shared.secrets import get_secret
from shared.admin_auth import _verify_entra_token


def create_admin_token(admin_id: str, email: str, name: str, ttl_hours: int = 8) -> str:
    """Create a JWT token for admin credential authentication.

    Args:
        admin_id: Unique admin identifier
        email: Admin email address
        name: Admin display name
        ttl_hours: Token time-to-live in hours

    Returns:
        Encoded JWT token string
    """
    secret = get_secret("JWT-SECRET", env_fallback="JWT_SECRET")

    payload = {
        "admin_id": admin_id,
        "email": email,
        "name": name,
        "role": "admin",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
    }

    token = jwt.encode(payload, secret, algorithm="HS256")
    return token


def create_user_token(user_id: str, email: str, name: str, ttl_hours: int = 24) -> str:
    """Create a JWT token for user authentication.
    
    Args:
        user_id: Unique user identifier
        email: User email address
        name: User name
        ttl_hours: Token time-to-live in hours
        
    Returns:
        Encoded JWT token string
    """
    secret = get_secret("JWT-SECRET", env_fallback="JWT_SECRET")
    
    payload = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "role": "user",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
    }
    
    token = jwt.encode(payload, secret, algorithm="HS256")
    return token


def verify_token(token: str) -> Optional[Dict]:
    """Verify and decode a JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded payload dict if valid, None if invalid/expired
    """
    secret = get_secret("JWT-SECRET", env_fallback="JWT_SECRET")
    
    # First try application-issued HS256 token
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        # Not a valid HS256 token; try verifying as an Entra (Azure AD) token
        try:
            entra_payload = _verify_entra_token(token)
            return entra_payload
        except Exception:
            return None
