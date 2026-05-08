"""Centralised secret loader for QuickAid Azure Functions.

Resolution order for every secret:

1. Azure Key Vault (when ``KEY_VAULT_URL`` is configured).
   Authentication is via ``DefaultAzureCredential``, which picks up the
   Function App's System-Assigned Managed Identity in Azure and the
   developer's ``az login`` / Visual Studio Code credentials locally.

2. Process environment variable named ``env_fallback`` (only when supplied
   by the caller). This exists so local development and Key Vault
   reference syntax in App Settings continue to work without requiring a
   live Key Vault connection.

The loader intentionally never falls back to a hard-coded literal value.
If neither source yields the secret, a ``RuntimeError`` is raised so the
failure is loud rather than silent.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Optional

try:
    from azure.identity import DefaultAzureCredential
    from azure.keyvault.secrets import SecretClient

    _AZURE_SDK_AVAILABLE = True
except ImportError:
    _AZURE_SDK_AVAILABLE = False


@lru_cache(maxsize=1)
def _client() -> Optional["SecretClient"]:
    vault_url = os.environ.get("KEY_VAULT_URL", "").strip()
    if not vault_url or not _AZURE_SDK_AVAILABLE:
        return None
    try:
        return SecretClient(
            vault_url=vault_url,
            credential=DefaultAzureCredential(),
        )
    except Exception as exc:
        logging.error("Failed to initialise Key Vault client: %s", exc)
        return None


@lru_cache(maxsize=64)
def get_secret(secret_name: str, env_fallback: Optional[str] = None) -> str:
    """Return the value of ``secret_name`` from Key Vault or env fallback.

    Args:
        secret_name: Name of the secret in Azure Key Vault.
        env_fallback: Optional environment variable name to consult when
            Key Vault is not available or the secret cannot be retrieved.

    Raises:
        RuntimeError: When the secret cannot be resolved from any source.
    """
    client = _client()
    if client is not None:
        try:
            value = client.get_secret(secret_name).value
            if value:
                return value
            logging.warning(
                "Key Vault returned empty value for secret '%s'.", secret_name
            )
        except Exception as exc:
            logging.warning(
                "Key Vault lookup failed for '%s' (%s). Trying env fallback.",
                secret_name,
                exc,
            )

    if env_fallback:
        env_value = os.environ.get(env_fallback)
        if env_value:
            return env_value

    raise RuntimeError(
        f"Secret '{secret_name}' could not be resolved from Key Vault or "
        f"environment variable '{env_fallback}'."
    )
