# MatterMiner Node Service: Project Overview

Welcome to the documentation for the **MatterMiner Node Service**. This document is designed to give both technical and non-technical stakeholders a clear understanding of what this application does, how it is built, and how it is deployed.

---

## 1. What is this Service? (For Non-Tech Users)

Think of the **MatterMiner Node Service** as the central "traffic controller" and "integration hub" for the MatterMiner platform. 

While the Python AI application handles the deep machine learning tasks, this Node.js service is responsible for:
- **Calendar Integrations:** Talking to Google and Microsoft to schedule, sync, and manage calendar events.
- **Data Storage:** Securely saving chat sessions, audit logs, billing wallets, and event histories into the MySQL database.
- **AI Coordination (RAG):** Preparing and retrieving relevant text data using Pinecone (a vector database) and OpenAI, ensuring the AI has the right context before it speaks.
- **Background Tasks:** Using a messaging queue (RabbitMQ) to handle heavy tasks without slowing down the user experience.

---

## 2. System Architecture

The application is built with security and scalability in mind.

1. **The Gateway (Nginx):** When internet traffic arrives at our AWS server (EC2), a bouncer named Nginx intercepts it. Nginx handles the security (HTTPS) and strictly forwards the traffic to our isolated Docker environment.
2. **The Container (Docker):** The Node service lives inside a secure Docker container. It cannot be accessed directly from the public internet; it only accepts traffic from Nginx.
3. **Internal Networking:** The Node service shares a private network (`matterminer_shared_net`) with the Python AI service. This allows the two applications to securely talk to each other at lightning speed.
4. **The Vault (AWS Secrets Manager):** Hardcoded passwords do not exist in this codebase. When the application starts, it securely connects to AWS Secrets Manager, downloads the production passwords directly into its memory, and connects to the database.

---

## 3. Project Structure Guide (For Developers)

If you are a developer navigating the codebase, here is where everything lives:

### The Core Application (`/src`)
- **`/config`**: Configuration files. This is where `database.js` (MySQL connection), `migrator.js` (Umzug migrations), and `awsSecrets.js` (Secrets Manager integration) live.
- **`/controllers`**: The orchestrators. When an API route is hit, the controller figures out which services to call and what data to return.
- **`/models`**: The database structure. Powered by Sequelize, these files define the schema for `Event`, `Wallet`, `Integration`, `ChatSession`, and `AuditLog`.
- **`/routes`**: The API map. Defines the URLs (endpoints) that clients and the Python service can request.
- **`/services`**: The heavy lifters. This holds the core business logic (e.g., `googleCalendarService.js`).
- **`/utils`**: Helper functions like the `piiSanitizer.js` (for removing personal info) and `rabbitMQ.js` (for message queuing).
- **`/middleware`**: The security checkpoints. Contains logic like `basicAuth.js` to ensure incoming requests are authorized.
- **`/workers`**: Background processors that listen to RabbitMQ and execute heavy jobs outside the main API thread.

### Database Migrations (`/migrations`)
We use **Umzug** for production-grade database migrations.
- **`migrations/sql/`**: Contains raw `.sql` files representing the exact schema. This is your single source of truth.
- **`migrations/*.js`**: Javascript executors that read the SQL files and safely apply them to the database on startup.

### Containerization
- **`Dockerfile`**: Instructions for building the lightweight, secure Alpine Linux Node environment.
- **`docker-compose.yml`**: The orchestrator file that binds ports to the host (Nginx) and connects the service to the internal Docker network.

---

## 4. How to Run It

### Locally (Development)
1. Ensure you have `.env` configured with the necessary bootstrap variables.
2. Run `npm install` to grab all dependencies.
3. Start the application: `npm run dev` (uses nodemon for hot-reloading).

### Production (EC2 Server)
1. Pull the latest code from the `master` branch.
2. Ensure the production `.env` file exists on the host with the `AWS_SECRET_ID` bootstrap variables.
3. Run `docker compose up -d --build`.
4. The service will fetch secrets, run migrations automatically, and start listening behind Nginx on port `3000`.
