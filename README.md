# Quick Aid – Azure Functions Backend

## Project Structure

```
quick-aid-backend/
├── submit_ticket/
│   ├── __init__.py       # POST /api/tickets
│   └── function.json
├── get_tickets/
│   ├── __init__.py       # GET  /api/tickets?email=...
│   └── function.json
├── host.json
├── local.settings.json   # ← fill in your secrets (never commit this)
├── requirements.txt
└── README.md
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Azure Functions Core Tools | v4 |
| Azure CLI | latest |

Install Core Tools:
```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

---

## Cosmos DB Setup

1. Create a **Cosmos DB account** (NoSQL / Core API).
2. Create a **Database** named `QuickAidDB`.
3. Create a **Container** named `Tickets` with partition key `/email`.
4. Copy the **Primary Connection String** from *Keys* in the Azure Portal.

---

## Local Development

```bash
# 1. Clone / open the project
cd quick-aid-backend

# 2. Create & activate virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Fill in local.settings.json with your Cosmos connection string

# 5. Start the function app locally
func start
```

---

## API Reference

### POST /api/tickets — Submit a ticket

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
  "ticketId":  "b3d2f1a0-...",
  "status":    "Open",
  "createdAt": "2026-03-26T10:00:00+00:00"
}
```

**Error responses:** `400` (missing/invalid fields) · `500` (DB error)

---

### GET /api/tickets — Get tickets by email

**Query parameters:**

| Parameter  | Required | Description                        |
|------------|----------|------------------------------------|
| `email`    | ✅ Yes    | Filter by submitter email          |
| `status`   | No        | `Open` or `Closed`                 |
| `category` | No        | `IT`, `HR`, `Finance`, etc.        |

**Example:**
```
GET /api/tickets?email=user@example.com&status=Open&category=IT
```

**Success response — 200:**
```json
{
  "email":      "user@example.com",
  "totalCount": 2,
  "tickets": [
    {
      "id":          "b3d2f1a0-...",
      "ticketId":    "b3d2f1a0-...",
      "email":       "user@example.com",
      "title":       "Cannot access VPN",
      "description": "Getting error 404 when connecting to VPN.",
      "category":    "IT",
      "status":      "Open",
      "createdAt":   "2026-03-26T10:00:00+00:00",
      "updatedAt":   "2026-03-26T10:00:00+00:00"
    }
  ]
}
```

---

## Deploy to Azure

```bash
# Login
az login

# Create Function App (if not already created)
az functionapp create \
  --resource-group <YOUR_RG> \
  --consumption-plan-location eastus \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --name quick-aid-api \
  --storage-account <YOUR_STORAGE>

# Set environment variables in Azure
az functionapp config appsettings set \
  --name quick-aid-api \
  --resource-group <YOUR_RG> \
  --settings \
    COSMOS_CONNECTION_STRING="<YOUR_CONNECTION_STRING>" \
    COSMOS_DATABASE_NAME="QuickAidDB" \
    COSMOS_CONTAINER_NAME="Tickets"

# Deploy
func azure functionapp publish quick-aid-api
```
