# Gopher Textbook Exchange

A peer-to-peer marketplace where University of Minnesota students buy and sell
used textbooks directly to each other. Students post listings with photos, set
their own price, and either accept a flat **Buy Now** request, negotiate via
**Make an Offer**, or chat through an in-app messaging system.

- **Frontend:** React 18 + Vite, deployed as static assets.
- **Backend:** Node.js + Express, JWT auth, bcrypt password hashing.
- **Storage:** Amazon DynamoDB (9 tables) for application data, Amazon S3 for
  listing image uploads.
- **Production host:** A single Amazon Linux EC2 instance running the API behind
  PM2; built static client bundle is served by the same Node process.

---

## Table of Contents

1. [Project layout](#project-layout)
2. [Prerequisites](#prerequisites)
3. [Run locally (recommended for evaluation)](#run-locally-recommended-for-evaluation)
4. [Deploy to AWS from scratch](#deploy-to-aws-from-scratch)
5. [Update an already-deployed instance](#update-an-already-deployed-instance)
6. [Environment variables reference](#environment-variables-reference)
7. [Useful commands](#useful-commands)
8. [Architecture notes](#architecture-notes)

---

## Project layout

```
gopher-textbook-exchange/
├── deploy.sh                      # one-shot deploy script run on the EC2 host
├── my-app/
│   ├── package.json               # workspace root (npm workspaces)
│   ├── docker-compose.yml         # spins up DynamoDB Local for development
│   ├── client/                    # React + Vite frontend
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   └── src/
│   └── server/                    # Express backend
│       ├── package.json
│       ├── .env.example           # template for the .env you create
│       └── src/
│           ├── index.js           # server entry point
│           ├── routes/            # /api/auth, /api/listings, /api/conversations, etc.
│           ├── middleware/        # JWT auth middleware
│           └── db/                # DynamoDB client, schema, seed scripts
└── README.md                      # this file
```

---

## Prerequisites

To run **locally**, you need:

- **Node.js 18+** and npm (Node 20 LTS recommended).
- **Docker Desktop** (for local DynamoDB; alternative: real AWS credentials).
- **Git** to clone the repository.

To deploy **to AWS**, you additionally need:

- An **AWS account** with permission to create DynamoDB tables and an S3 bucket.
- An EC2 instance (Amazon Linux 2023 or similar) with Node.js installed,
  reachable via SSH, security group permitting port 80 / 3001 inbound.
- An **IAM user or instance role** with read/write access to your DynamoDB
  tables and S3 bucket.

---

## Run locally (recommended for evaluation)

This path runs the full stack on one machine with no AWS account required.
It uses **DynamoDB Local** (an Amazon-provided container that mimics real
DynamoDB) and disables S3 image uploads; the rest of the app works end-to-end.

### 1. Clone and install dependencies

```bash
git clone https://github.com/stork066/gopher-textbook-exchange.git
cd gopher-textbook-exchange/my-app
npm install
```

`npm install` at the workspace root pulls dependencies for both the client and
the server because the project uses npm workspaces.

### 2. Start DynamoDB Local

```bash
docker compose up -d dynamodb-local
```

This runs DynamoDB Local on `http://127.0.0.1:8000` and persists data in
`my-app/dynamodb-data/` so it survives container restarts.

### 3. Create the server `.env` file

```bash
cd server
cp .env.example .env
```

Open `my-app/server/.env` and set at least:

```
PORT=3001
DYNAMODB_ENDPOINT=http://127.0.0.1:8000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
JWT_SECRET=any-long-random-string
JWT_EXPIRES_IN=7d
S3_BUCKET=
```

`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` can be any non-empty placeholder
strings when talking to DynamoDB Local — the local server doesn't validate them.
Leaving `S3_BUCKET` empty disables the photo-upload feature; everything else
works (a placeholder image is shown on listings).

### 4. Create the DynamoDB tables

From `my-app/server/`:

```bash
npm run setup
```

This creates 9 tables (Users, Listings, Conversations, Messages, Cart, etc.)
and their secondary indexes inside DynamoDB Local. Re-running it is safe — it
skips tables that already exist.

### 5. (Optional) Seed sample data

From `my-app/server/`:

```bash
npm run seed
```

Populates the database with sample users, departments, and listings so the
marketplace isn't empty on first load.

### 6. Run the dev servers

From `my-app/` (the workspace root):

```bash
npm run dev
```

This concurrently starts:

- **API server** on `http://localhost:3001` (auto-reloads via `nodemon`)
- **Vite dev server** on `http://localhost:5173` (hot-reloads on save)

Vite is configured to proxy `/api` requests to the API server, so just open
**http://localhost:5173** in your browser. The site is fully functional:
sign up, post a listing, browse, send offers, message the seller.

### 7. Stopping local services

```bash
# Stop the dev servers: Ctrl+C in the terminal running `npm run dev`
docker compose down            # stop DynamoDB Local
```

---

## Deploy to AWS from scratch

Follow this section if you are setting up a fresh production environment. The
already-deployed instance is updated via the [much shorter procedure
below](#update-an-already-deployed-instance).

### 1. Create AWS resources

In the AWS console (or via CLI), in your chosen region (e.g. `us-east-1`):

1. **Create an S3 bucket** for listing photos. Note the bucket name. Make
   listing images publicly readable (the client links directly to S3 URLs).
2. **Create an IAM user or EC2 instance role** with permission to:
   - `dynamodb:*` on the tables this app creates, **and**
   - `s3:PutObject` / `s3:GetObject` on the bucket above.
3. **Launch an EC2 instance** (Amazon Linux 2023 t3.micro is enough). Open
   inbound port 80 (or whatever port you pick) in its security group. Attach
   the IAM role from the previous step, or copy the access keys for the env file.

### 2. Install runtime dependencies on the EC2 host

SSH in and run, once:

```bash
sudo dnf install -y git nodejs   # Amazon Linux 2023
sudo npm install -g pm2
```

### 3. Clone and configure the app

```bash
cd ~
git clone https://github.com/stork066/gopher-textbook-exchange.git
cd gopher-textbook-exchange/my-app
npm install
cd server
cp .env.example .env
```

Edit `server/.env` with **production** values:

```
NODE_ENV=production
PORT=80
AWS_REGION=us-east-1
# DYNAMODB_ENDPOINT must be UNSET so the SDK talks to real AWS
JWT_SECRET=<generate a long random string — different from dev>
JWT_EXPIRES_IN=7d
S3_BUCKET=<your bucket name from step 1>
# If using IAM user keys instead of an instance role:
# AWS_ACCESS_KEY_ID=<your IAM key>
# AWS_SECRET_ACCESS_KEY=<your IAM secret>
```

### 4. Create the production DynamoDB tables

From `my-app/server/`:

```bash
npm run setup
```

This creates the same 9 tables in your real AWS account (on-demand billing).
Run once per environment.

### 5. Build the client

From `my-app/client/`:

```bash
npm run build
```

Outputs static assets to `my-app/client/dist/`. In production, the Express
server serves these files for any non-`/api` route.

### 6. Start the server under PM2

If your server listens on port 80 you'll need to run with elevated capability;
the simplest path is to bind PM2 to port 3001 and put nginx in front, **or**
use the Linux `setcap` trick to let Node bind low ports without root:

```bash
sudo setcap 'cap_net_bind_service=+ep' "$(which node)"
```

Then, from `my-app/server/`:

```bash
pm2 start src/index.js --name gopher
pm2 save
pm2 startup            # follow the printed instructions to enable on boot
```

The site is now live at `http://<your-ec2-public-ip>/`.

---

## Update an already-deployed instance

Once steps 1-6 above have been done once, every subsequent deploy is a single
SSH command. The deploy script at the repo root (`deploy.sh`) handles the full
update flow:

```bash
ssh -i path/to/your-key.pem ec2-user@<your-ec2-host> \
  'bash ~/gopher-textbook-exchange/deploy.sh'
```

`deploy.sh` does:

1. `git pull --ff-only` from `origin/main` (refuses to merge if local diverged).
2. Reinstalls client and/or server dependencies — but only if the relevant
   `package-lock.json` actually changed in the pull.
3. `npm run build` in the client (outputs new bundles into `client/dist/`).
4. `pm2 reload all` so the API server picks up backend changes with no downtime.

After the script finishes, hard-refresh the browser (`Cmd+Shift+R`) to clear
any cached JS bundle.

---

## Environment variables reference

All variables live in `my-app/server/.env`. The template is `.env.example`.

| Variable | Required? | Purpose |
|---|---|---|
| `PORT` | yes | Port the Express API binds to (3001 in dev, 80 in prod). |
| `NODE_ENV` | prod only | Set to `production` to serve the built client from the API server and disable dev-only behavior. |
| `DYNAMODB_ENDPOINT` | dev only | `http://127.0.0.1:8000` for DynamoDB Local. **Leave unset in production** so the AWS SDK uses the real DynamoDB endpoint for `AWS_REGION`. |
| `AWS_REGION` | yes | AWS region for DynamoDB and S3 (e.g. `us-east-1`). |
| `AWS_ACCESS_KEY_ID` | sometimes | IAM access key. Required locally and when not using an EC2 instance role in production. |
| `AWS_SECRET_ACCESS_KEY` | sometimes | IAM secret. Same conditions as the access key. |
| `JWT_SECRET` | yes | Signing key for auth tokens. Use a long random string. **Change between dev and prod.** |
| `JWT_EXPIRES_IN` | no | Token lifetime (default `7d`). |
| `S3_BUCKET` | no | Bucket name for listing photos. Leave empty to disable uploads. |

The client has no environment variables — it only reaches the API through the
Vite proxy in dev or via same-origin requests in production.

---

## Useful commands

Run from the indicated directory.

| Command | From | What it does |
|---|---|---|
| `npm install` | `my-app/` | Installs deps for client + server (npm workspaces). |
| `npm run dev` | `my-app/` | Starts client (Vite, port 5173) and server (nodemon, port 3001) concurrently. |
| `npm run build` | `my-app/` | Builds the client into `my-app/client/dist/`. |
| `npm run setup` | `my-app/server/` | Creates all DynamoDB tables and indexes. Idempotent. |
| `npm run seed` | `my-app/server/` | Loads sample users / departments / listings. |
| `docker compose up -d dynamodb-local` | `my-app/` | Starts DynamoDB Local on port 8000. |
| `docker compose down` | `my-app/` | Stops DynamoDB Local. |
| `bash deploy.sh` | repo root **on EC2** | Pulls main, rebuilds client, reloads PM2. |
| `pm2 status` / `pm2 logs gopher` | EC2 | Inspect running server process. |

---

## Architecture notes

- **Auth.** The server signs a JWT on login/signup. Clients send it as
  `Authorization: Bearer <token>`. Passwords are hashed with bcrypt
  (10 rounds). Auth middleware lives at `my-app/server/src/middleware/auth.js`.

- **Listings.** Each listing has a department + course, condition, price, and
  up to 8 photos. Photos upload directly through the API to S3; the API stores
  the resulting public URLs on the listing row.

- **Buying flow.** Three options on a listing — Add to Cart, Buy Now, or Make
  an Offer. Buy Now and Make an Offer both go through the
  **Conversations + Messages** system: a `buy_now` or `offer` message lands in
  the seller's inbox, and the seller can Accept or Decline. The listing flips
  to **Pending** on Accept; nothing is sold unilaterally.

- **Throttle rule.** A buyer can have at most one unresolved request
  (offer or buy_now) per listing. A Buy Now request may override an existing
  pending offer (escalation), but two Buy Nows can't coexist.

- **Seller actions.** In the message thread the seller sees an
  Accept / Decline bar; the label adapts to the latest unresolved request type
  ("Accept Buy Now" vs. "Accept Offer").

- **Polling.** Conversation lists and threads refresh on a 5-second poll
  (no WebSocket transport).
