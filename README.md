# QuickAid – Azure Functions Backend

QuickAid is an internal helpdesk system. The backend is a set of Python
Azure Functions that persist tickets in Cosmos DB and send SendGrid
confirmation emails. Secrets live in Azure Key Vault and are retrieved at
runtime via the Function App's System-Assigned Managed Identity — no
secret values are hard-coded in source.

## Project Structure

```
QuickAid/
├── backend/
│   ├── shared/
│   │   ├── __init__.py
│   │   └── secrets.py          # Key Vault loader (Managed Identity)
│   ├── submit_ticket/          # POST /api/submit_ticket
│   ├── get_ticket/             # GET  /api/get_ticket
│   ├── get_tickets/            # GET  /api/get_tickets (alias of get_ticket)
│   ├── register_user/          # POST /api/register_user
│   ├── register_admin/         # POST /api/register_admin
│   ├── user_login/             # POST /api/user_login
│   ├── admin_login/            # POST /api/login/admin
│   ├── host.json
│   ├── local.settings.json     # gitignored — fill from local.settings.json.example
│   ├── local.settings.json.example
│   └── requirements.txt
├── frontend/                   # Static HTML/CSS hosted on Azure App Service
└── .github/workflows/          # CI/CD: deploy backend & frontend on push to main
```

---

## Prerequisites

| Tool                       | Version  |
|----------------------------|----------|
| Python                     | 3.11+    |
| Azure Functions Core Tools | v4       |
| Azure CLI                  | latest   |

```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

---

## Architecture

```
Browser  ──►  Azure App Service (frontend)
Browser  ──►  Azure Functions (Python)
                │
                ├── Cosmos DB (Tickets)
                ├── Key Vault (Secrets)         ⟵ via Managed Identity
                └── SendGrid (Email API)        ⟵ key fetched from Key Vault
```

Secrets stored in Key Vault:

| Secret name        | Purpose                                  |
|--------------------|------------------------------------------|
| `CosmosPrimaryKey` | Cosmos DB primary key                    |
| `SendGridApiKey`   | SendGrid API key                         |
| `PasswordPepper`   | HMAC pepper for user/admin password hash |

Non-secret App Settings:

| Setting               | Purpose                                                   |
|-----------------------|-----------------------------------------------------------|
| `COSMOS_ENDPOINT`     | `https://<account>.documents.azure.com:443/`              |
| `COSMOS_DATABASE`     | `QuickAidDB`                                              |
| `COSMOS_CONTAINER`    | `Tickets`                                                 |
| `KEY_VAULT_URL`       | `https://<vault-name>.vault.azure.net/`                   |
| `SENDGRID_FROM_EMAIL` | A verified SendGrid sender                                |

`COSMOS_KEY`, `PASSWORD_SECRET`, and `SENDGRID_API_KEY` are **only** used
as local-development fallbacks; in Azure they are resolved from Key Vault
via Managed Identity.

---

## Cosmos DB Setup

1. Create a **Cosmos DB** account (NoSQL / Core API).
2. Create a **Database** named `QuickAidDB`.
3. Create a **Container** named `Tickets` with partition key `/email`.
4. Copy the **Primary Key** from *Keys* in the Azure Portal — you'll
   store this in Key Vault as `CosmosPrimaryKey`.

---

## Local Development

```bash
cd backend

# 1. Create & activate virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create local settings from the template
cp local.settings.json.example local.settings.json
# Then edit local.settings.json with your real values

# 4. Start the function app locally
func start
```

`local.settings.json` is git-ignored. Two ways to run locally:

**Option A — env vars only (no Key Vault required):**

Leave `KEY_VAULT_URL` empty in `local.settings.json` and fill in
`COSMOS_KEY`, `PASSWORD_SECRET`, `SENDGRID_API_KEY` directly.

**Option B — Key Vault from your dev machine:**

Set `KEY_VAULT_URL` to your vault, then `az login`. The
`DefaultAzureCredential` in `shared/secrets.py` will use your AAD
identity to read secrets — provided you have at least
`Key Vault Secrets User` on the vault.

---

## Deploy to Azure

### 1. Resource group + Function App

```bash
RG=quickaid-rg
LOC=southeastasia
STORAGE=quickaidstg$RANDOM
FUNCAPP=quickaid-api
WEBAPP=quickaid-web
COSMOS=quickaid-cosmos
KV=quickaid-kv

az group create -n $RG -l $LOC

az storage account create -n $STORAGE -g $RG -l $LOC --sku Standard_LRS

az functionapp create \
  --resource-group $RG \
  --consumption-plan-location $LOC \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --name $FUNCAPP \
  --storage-account $STORAGE
```

### 2. Enable System-Assigned Managed Identity

```bash
az functionapp identity assign -g $RG -n $FUNCAPP
PRINCIPAL_ID=$(az functionapp identity show -g $RG -n $FUNCAPP --query principalId -o tsv)
echo "Function App MI principalId: $PRINCIPAL_ID"
```

### 3. Create Key Vault and grant the MI read access

```bash
az keyvault create \
  -g $RG -n $KV -l $LOC \
  --enable-rbac-authorization true

VAULT_ID=$(az keyvault show -n $KV -g $RG --query id -o tsv)

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee-object-id $PRINCIPAL_ID \
  --assignee-principal-type ServicePrincipal \
  --scope $VAULT_ID
```

Also grant your developer account `Key Vault Secrets Officer` on
`$VAULT_ID` so you can write the secrets.

### 4. Store the secrets in Key Vault

```bash
COSMOS_PRIMARY_KEY=$(az cosmosdb keys list -g $RG -n $COSMOS \
                      --type keys --query primaryMasterKey -o tsv)

az keyvault secret set --vault-name $KV --name CosmosPrimaryKey --value "$COSMOS_PRIMARY_KEY"
az keyvault secret set --vault-name $KV --name SendGridApiKey   --value "<your-sendgrid-api-key>"
az keyvault secret set --vault-name $KV --name PasswordPepper   --value "$(openssl rand -hex 32)"
```

### 5. Configure Function App settings

```bash
COSMOS_ENDPOINT=$(az cosmosdb show -g $RG -n $COSMOS --query documentEndpoint -o tsv)

az functionapp config appsettings set \
  --name $FUNCAPP --resource-group $RG \
  --settings \
    COSMOS_ENDPOINT="$COSMOS_ENDPOINT" \
    COSMOS_DATABASE="QuickAidDB" \
    COSMOS_CONTAINER="Tickets" \
    KEY_VAULT_URL="https://$KV.vault.azure.net/" \
    SENDGRID_FROM_EMAIL="<verified-sender@yourdomain.com>"
```

> **No raw secret values are passed here.** They live in Key Vault and
> are pulled by `shared/secrets.py` at runtime via the Function App's
> Managed Identity.

### 6. Deploy

```bash
cd backend
func azure functionapp publish $FUNCAPP
```

Or use the GitHub Actions workflow at
`.github/workflows/deploy-backend.yml` (push to `main` triggers a
deploy).

---

## API Reference

### POST `/api/submit_ticket` — Submit a ticket

**Request body (JSON):**
```json
{
  "email":       "user@example.com",
  "title":       "Cannot access VPN",
  "description": "Getting error 404 when connecting to VPN.",
  "category":    "IT"
}
```

**Allowed categories:** `IT`, `HR`, `Finance`, `Operations`, `General`

**Success response — 201:**
```json
{
  "message":   "Ticket submitted successfully.",
  "ticketId":  "TCKT-01",
  "type":      "ticket",
  "status":    "Open",
  "createdAt": "2026-05-09T14:00:00+00:00"
}
```

**Side effect:** A SendGrid confirmation email is sent to the submitter.
If SendGrid send fails, the ticket is still saved (the failure is logged
and the API still returns 201). The persisted ticket is the source of
truth.

**Error responses:** `400` (missing/invalid fields) · `409` (ticket id
collision) · `500` (DB error / config error).

### GET `/api/get_ticket` (alias `/api/get_tickets`) — Get tickets by email

| Parameter  | Required | Description                  |
|------------|----------|------------------------------|
| `email`    | yes      | Filter by submitter email    |
| `status`   | no       | `Open` or `Closed`           |
| `category` | no       | `IT`, `HR`, `Finance`, etc.  |

**Example:**
```
GET /api/get_ticket?email=user@example.com&status=Open&category=IT
```

### Auth endpoints

| Endpoint                | Method | Purpose                  |
|-------------------------|--------|--------------------------|
| `/api/register_user`    | POST   | Create end-user account  |
| `/api/register_admin`   | POST   | Create admin account     |
| `/api/user_login`       | POST   | Authenticate end user    |
| `/api/login/admin`      | POST   | Authenticate admin       |

All four hash passwords using HMAC-SHA256 with a per-deployment pepper
read from Key Vault (`PasswordPepper`).

---

## Smoke test the end-to-end flow

```bash
FUNC_HOST=$(az functionapp show -g $RG -n $FUNCAPP --query defaultHostName -o tsv)

curl -sS -X POST https://$FUNC_HOST/api/submit_ticket \
  -H "Content-Type: application/json" \
  -d '{
        "email":"<your-real-inbox>@example.com",
        "title":"E2E test",
        "description":"verifying KV+MI+SendGrid path",
        "category":"IT"
      }' | jq
```

Expected outcomes:

1. HTTP 201 with a `ticketId` like `TCKT-01`.
2. The ticket appears in Cosmos DB:
   ```bash
   az cosmosdb sql query \
     --account-name $COSMOS \
     --database-name QuickAidDB \
     --container-name Tickets \
     --query-text "SELECT * FROM c WHERE c.email='<your-real-inbox>@example.com'"
   ```
3. A confirmation email arrives in your inbox within ~30 seconds.
4. SendGrid → *Activity* tab shows a `Delivered` row for that recipient
   (screenshot this — it is the deliverable proof).

---

## Security checklist

- [x] No hard-coded secrets in source code.
- [x] `local.settings.json` is git-ignored; only `.example` is committed.
- [x] Function App has System-Assigned Managed Identity.
- [x] Managed Identity has only `Key Vault Secrets User` (least privilege).
- [x] Cosmos primary key, SendGrid key and password pepper live in Key Vault.
- [x] Functions retrieve secrets via `DefaultAzureCredential` at runtime
      (`backend/shared/secrets.py`) — not from environment variables in production.
- [x] SendGrid confirmation email is sent after every ticket submission;
      send failures are logged and never roll back the persisted ticket.
