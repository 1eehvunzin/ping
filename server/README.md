# ping server

FastAPI backend for the `ping` pager device. Data is persisted in Postgres
(Supabase) — state survives restarts. Domain model mirrors
`frontend/src/pager/reducer.ts`: accounts (ID + password), an inbox, and a
message-request queue for first-time senders (approve to add them to your
known senders, decline to discard).

## Run

```bash
cd server
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

Create `server/.env` (gitignored, never commit it) with your Supabase DB
connection string:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

Use the **pooler** host from Supabase's dashboard (Project Settings →
Database → Connection string → Transaction pooler), not the direct
`db.<project-ref>.supabase.co` host — the direct host is IPv6-only and won't
be reachable from networks without IPv6 egress. Tables are created
automatically on startup.

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive docs at http://localhost:8000/docs once it's running. CORS is
open to `http://localhost:5173` (the Vite dev server) for local testing
against the frontend.

## Endpoints

- `POST /accounts/register` `{id, password}`
- `POST /accounts/login` `{id, password}`
- `GET /accounts/{id}`
- `POST /messages/send` `{from_id, to_id, code}`
- `GET /messages/{id}/inbox`
- `GET /messages/{id}/requests`
- `POST /messages/{id}/requests/{message_id}/approve`
- `POST /messages/{id}/requests/{message_id}/decline`
- `POST /messages/{id}/inbox/{message_id}/read`
- `GET /presets`
