# DBOS-Spring: Crash-Proof Workflow Engine, Cryptographic Provenance & Time-Travel Debugger

> **Inspired by MIT & Stanford University's [DBOS / Apiary](https://www.dbos.dev/), R3 (Record-Replay-Retroaction), and Epoxy Research**

**DBOS-Spring** is a database-native durable execution engine, row-level data provenance tracker, and deterministic time-travel debugger built with **Java, Spring Boot, Spring AOP, PostgreSQL, and React/TypeScript**.

Instead of relying on heavy external orchestration clusters (such as Temporal, Airflow, or Kafka), DBOS-Spring uses PostgreSQL ACID transactions as the single source of truth to make distributed multi-step business workflows crash-proof, cryptographically auditable, and replayable in an isolated sandbox.

---

## Why DBOS-Spring?

In distributed financial and enterprise applications, three critical failure modes occur:
1. **Mid-Flight Server Crashes & Double-Charging:** A payment workflow deducts money from a sender, crashes before crediting the receiver, and charges the sender a second time upon retry.
2. **Silent Data Tampering:** Traditional application logs exist outside the database and can become out-of-sync or fail to detect unauthorized direct edits to historical database records.
3. **Non-Reproducible Production Bugs:** Debugging a failure hours after it occurred is difficult because live account balances and database rows have already mutated.

**DBOS-Spring solves all three directly inside PostgreSQL:**
* **Exactly-Once Step Execution (`@Workflow` & `@Step`):** Automatically checkpoints step outputs in PostgreSQL. If a server crashes mid-workflow, completed steps are skipped on recovery and return their saved checkpoint.
* **Lock-Free Auto-Recovery Worker:** A background scheduler scans for interrupted `PENDING` workflows using `SELECT ... FOR UPDATE SKIP LOCKED` and resumes them automatically without human intervention.
* **Tamper-Evident Row Provenance:** Every row mutation records `before_json` and `after_json` snapshots chained together with a cryptographic $\text{SHA-256}$ hash chain to immediately pinpoint unauthorized database tampering.
* **R3 Time-Travel Sandbox Replay:** Reconstructs historical row states as they existed right before any past workflow executed, re-runs the workflow in an in-memory sandbox, and verifies deterministic state convergence.

---

## System Architecture

~~~mermaid
flowchart TB
    subgraph Frontend ["Layer 4: React + TypeScript Visual Debugger Studio"]
        DAG["Live React Flow Workflow DAG"]
        Controls["Chaos Crash & Tamper Controls"]
        Inspector["SHA-256 Provenance & R3 Replay Viewer"]
    end

    subgraph Engine ["DBOS-Spring Core Engine (Spring Boot + AOP)"]
        Aspect["Layer 1: WorkflowAspect (@Workflow / @Step Interceptor)"]
        Worker["Layer 1: RecoveryWorker (FOR UPDATE SKIP LOCKED)"]
        Provenance["Layer 2: ProvenanceService (SHA-256 Hash Chain)"]
        Replay["Layer 3: ReplayService (R3 Historical Sandbox)"]
    end

    subgraph DB ["PostgreSQL 16 (Single Source of Truth)"]
        WF[("workflow_status")]
        STEPS[("step_outputs")]
        PROV[("provenance_events")]
        ACC[("accounts (Business Table)")]
    end

    Frontend <-->|"REST API (/api/*)"| Engine
    Aspect -->|"Read/Write Checkpoints"| WF
    Aspect -->|"Skip or Save Step Output"| STEPS
    Worker -->|"Poll Stuck PENDING Workflows"| WF
    Provenance -->|"Append Chained Row Snapshots"| PROV
    Replay -->|"Reconstruct Past State"| PROV
    Aspect -->|"Execute Business SQL"| ACC
~~~

---

## Core Engineering Layers

### Layer 1: Durable Execution & Crash Recovery (`@Workflow` & `@Step`)
* Developers annotate any multi-step service method with `@Workflow` and its atomic operations with `@Step`.
* `WorkflowAspect` intercepts each `@Step` call and checks `step_outputs` for `(workflow_id, step_id)`.
* If a checkpoint exists, the engine skips execution and deserializes the stored output—guaranteeing idempotency across crashes and retries.
* `RecoveryWorker` runs every $5\text{ seconds}$, claims workflows stuck in `PENDING` status via `SELECT ... FOR UPDATE SKIP LOCKED`, and resumes execution from the exact point of failure.

### Layer 2: Row-Level Data Provenance & Cryptographic Audit Log
* Whenever a `@Step` mutates a database record, `ProvenanceService` logs the exact `before_json` and `after_json` row snapshots tied to `(workflow_id, step_id)`.
* Each event is cryptographically linked to the previous event using a $\text{SHA-256}$ hash chain:

$$H_n = \text{SHA-256}(H_{n-1} \parallel \text{workflow\_id} \parallel \text{step\_id} \parallel \text{table} \parallel \text{row\_key} \parallel \text{op} \parallel \text{before\_json} \parallel \text{after\_json})$$

* Calling `/api/verify` recomputes the entire chain from `GENESIS` and immediately flags the exact `event_id` and `workflow_id` if any historical record was altered.

### Layer 3: R3 Time-Travel State Reconstruction & Sandbox Replay
* Given any historical `workflow_id`, `ReplayService` queries the provenance timeline to reconstruct the exact starting balances (`historicalStateBefore`) prior to that workflow's execution—even if hundreds of subsequent transactions have modified the live tables since then.
* It re-executes the workflow inputs inside an isolated in-memory sandbox (`sandboxReplayedStateAfter`) without mutating live PostgreSQL rows and verifies `deterministicMatch == true`.

### Layer 4: Visual Debugger Studio (React + TypeScript + React Flow)
* **Live Workflow DAG:** Displays the 3-step Money Transfer pipeline (`Step 1: Deduct Sender` $\rightarrow$ `Step 2: Fraud Check` $\rightarrow$ `Step 3: Credit Receiver`), highlighting completed steps in green and mid-flight crashes in red.
* **Chaos Engineering Controls:** One-click buttons to trigger safe transfers, simulate a mid-flight server crash right after deducting funds, or simulate a malicious database hack on historical records.
* **Interactive Time-Travel Inspector:** Click any past workflow to inspect its checkpointed outputs and run a side-by-side R3 sandbox replay.

---

## Database Schema

| Table Name | Layer | Description |
| :--- | :--- | :--- |
| `workflow_status` | Layer 1 (Engine Core) | Tracks workflow lifecycle (`workflow_id`, `workflow_name`, `status`, `input_json`, `created_at`, `updated_at`). |
| `step_outputs` | Layer 1 (Engine Core) | Stores atomic step checkpoints (`workflow_id`, `step_id`, `step_name`, `output_json`, `completed_at`). |
| `provenance_events` | Layer 2 (Audit & Security) | Append-only row history (`event_id`, `workflow_id`, `step_id`, `table_name`, `row_key`, `op_type`, `before_json`, `after_json`, `prev_hash`, `curr_hash`). |
| `accounts` | Layer 4 (Demo Workload) | Demo bank accounts (`username`, `balance`) seeded with `alice` ($1000) and `bob` ($1000). |

---

## Project Structure

~~~text
dbosspring/
├── docker-compose.yml                  # PostgreSQL 16 container configuration
├── pom.xml                             # Maven build & Spring Boot / AOP dependencies
├── src/main/resources/
│   ├── application.yml                 # Database connection & schema initialization config
│   └── schema.sql                      # Auto-initialized engine & demo tables
├── src/main/java/com/example/dbosspring/
│   ├── engine/                         # REUSABLE DBOS-SPRING CORE ENGINE
│   │   ├── annotation/                 # @Workflow and @Step declarative annotations
│   │   ├── context/                    # ThreadLocal WorkflowContext (workflowId & stepId tracker)
│   │   ├── aspect/                     # WorkflowAspect AOP interceptor for checkpointing
│   │   ├── recovery/                   # Scheduled RecoveryWorker (FOR UPDATE SKIP LOCKED)
│   │   ├── provenance/                 # ProvenanceService (row capture & SHA-256 verifier)
│   │   └── replay/                     # ReplayService (R3 time-travel state reconstruction)
│   └── demo/                           # REFERENCE MONEY TRANSFER APPLICATION
│       ├── TransferWorkflowService.java# 3-step transfer workflow with crash simulation switch
│       └── TransferController.java     # REST API endpoints for execution, verification & replay
└── frontend/                           # React + TypeScript + React Flow Visual Debugger Studio
~~~

---

## Getting Started (Local Setup)

### Prerequisites
* **Java 21+** (or JDK 25)
* **Docker Desktop** (for PostgreSQL 16)
* **Node.js 18+** & **npm**

### 1. Start PostgreSQL via Docker Compose
From the project root directory (`dbosspring/`):
~~~powershell
docker compose up -d
~~~

### 2. Start the Spring Boot Engine Backend
~~~powershell
.\mvnw.cmd spring-boot:run
~~~
The backend server will start at `http://localhost:8080` and automatically initialize `schema.sql`.

### 3. Start the React Visual Debugger Studio
Open a second terminal and run:
~~~powershell
cd frontend
npm install
npm run dev
~~~
Open `http://localhost:5173` in your browser.

---

## End-to-End Verification Walkthrough

1. **Safe Execution:** Click **"Transfer $100 (Safe)"** in the dashboard. Observe `alice` move from `$1000` to `$900` and `bob` move from `$1000` to `$1100`, with all three DAG nodes turning green (`COMPLETED`).
2. **Crash & Auto-Recovery:** Click **"Transfer $100 (Simulate Mid-Flight Crash)"**.
   * `Step 1 (Deduct)` completes and checkpoints in PostgreSQL, deducting `$100` from `alice`.
   * The workflow crashes before `Step 2 (Fraud Check)` and turns red (`PENDING`).
   * Wait $5\text{ seconds}$: `RecoveryWorker` automatically detects the interrupted workflow, skips `Step 1` using the saved checkpoint (preventing a double deduction!), executes `Step 2` and `Step 3`, and marks the workflow `COMPLETED`.
3. **Cryptographic Tamper Detection:** Click **"Simulate DB Hack"** in the top-right header. An unauthorized SQL update alters a historical row in `provenance_events`. The provenance badge immediately switches from `INTEGRITY_VERIFIED` to `TAMPER_DETECTED`, identifying the exact compromised `event_id`.
4. **R3 Time-Travel Replay:** Click **"Replay in Sandbox"** on any historical workflow in the middle panel to reconstruct the historical balances prior to that transaction and verify `Deterministic Match: YES`.

---

## REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET/POST` | `/api/transfer?workflowId=tx-101&amount=100&crash=false` | Triggers a 3-step money transfer workflow (set `crash=true` to simulate a mid-flight failure). |
| `GET` | `/api/state` | Returns live account balances, workflow statuses, checkpoints, provenance events, and hash integrity status. |
| `GET` | `/api/verify` | Verifies the entire $\text{SHA-256}$ hash chain across `provenance_events`. |
| `GET/POST` | `/api/tamper` | Simulates an attacker modifying a historical balance inside `provenance_events`. |
| `GET` | `/api/replay?workflowId=tx-101` | Reconstructs historical state before `tx-101` and replays the transfer in an isolated sandbox. |
| `GET/POST` | `/api/reset` | Resets all tables and restores `alice` and `bob` to `$1000` each. |