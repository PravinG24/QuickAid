import json
import logging
import os
from typing import Any, Dict, Optional

from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
from azure.storage.blob import BlobClient, BlobServiceClient

from shared.secrets import get_secret

DEFAULT_BLOB_CONTAINER = os.environ.get("BLOB_LOG_CONTAINER", "logs")
DEFAULT_BLOB_FILE = os.environ.get("BLOB_LOG_FILE", "activitylogs.json")


def get_blob_service_client() -> BlobServiceClient:
    connection_string = get_secret(
        "BLOB_STORAGE_CONNECTION_STRING",
        env_fallback="BLOB_STORAGE_CONNECTION_STRING",
    )
    if not connection_string or not str(connection_string).strip():
        raise RuntimeError(
            "BLOB_STORAGE_CONNECTION_STRING is not configured. "
            "Set it in local.settings.json or App Settings."
        )
    return BlobServiceClient.from_connection_string(str(connection_string).strip())


def get_blob_client(
    container_name: Optional[str] = None,
    blob_name: Optional[str] = None,
) -> BlobClient:
    container_name = container_name or DEFAULT_BLOB_CONTAINER
    blob_name = blob_name or DEFAULT_BLOB_FILE
    service_client = get_blob_service_client()
    container_client = service_client.get_container_client(container_name)
    try:
        container_client.create_container()
    except ResourceExistsError:
        pass
    return container_client.get_blob_client(blob_name)


def read_json_blob(
    container_name: Optional[str] = None,
    blob_name: Optional[str] = None,
) -> Dict[str, Any]:
    blob_client = get_blob_client(container_name, blob_name)
    try:
        stream = blob_client.download_blob()
        payload = stream.readall()
        text = payload.decode("utf-8") if isinstance(payload, (bytes, bytearray)) else str(payload)
        if not text.strip():
            return {"activity_logs": [], "notifications": []}
        data = json.loads(text)
        if not isinstance(data, dict):
            return {"activity_logs": [], "notifications": []}
        data.setdefault("activity_logs", [])
        data.setdefault("notifications", [])
        return data
    except ResourceNotFoundError:
        return {"activity_logs": [], "notifications": []}
    except Exception as exc:
        logging.error("Failed to read blob %s/%s: %s", container_name, blob_name, exc)
        return {"activity_logs": [], "notifications": []}


def write_json_blob(
    content: Dict[str, Any],
    container_name: Optional[str] = None,
    blob_name: Optional[str] = None,
) -> bool:
    blob_client = get_blob_client(container_name, blob_name)
    try:
        data = json.dumps(content, indent=2, ensure_ascii=False).encode("utf-8")
        blob_client.upload_blob(data, overwrite=True)
        return True
    except Exception as exc:
        logging.error("Failed to write blob %s/%s: %s", container_name, blob_name, exc)
        return False
