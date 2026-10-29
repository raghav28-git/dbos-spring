-- 1. Tracks the overall Workflow status
CREATE TABLE IF NOT EXISTS workflow_status (
    workflow_id VARCHAR(128) PRIMARY KEY,
    workflow_name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL, -- PENDING, COMPLETED, FAILED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Stores the checkpoint of every Step inside a workflow
CREATE TABLE IF NOT EXISTS step_outputs (
    workflow_id VARCHAR(128) NOT NULL,
    step_id INT NOT NULL,
    step_name VARCHAR(128) NOT NULL,
    output_json TEXT,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workflow_id, step_id)
);

-- 3. Demo Table: Bank Accounts for our Money Transfer test
CREATE TABLE IF NOT EXISTS accounts (
    username VARCHAR(64) PRIMARY KEY,
    balance INT NOT NULL
);

-- Seed Alice and Bob with $1000 each (ignores if they already exist)
INSERT INTO accounts (username, balance) VALUES ('alice', 1000) ON CONFLICT DO NOTHING;
INSERT INTO accounts (username, balance) VALUES ('bob', 1000) ON CONFLICT DO NOTHING;
ALTER TABLE workflow_status ADD COLUMN IF NOT EXISTS input_json TEXT;

-- 4. Stores row-level history and SHA-256 tamper-evident hash chain
CREATE TABLE IF NOT EXISTS provenance_events (
    event_id SERIAL PRIMARY KEY,
    workflow_id VARCHAR(128) NOT NULL,
    step_id INT NOT NULL,
    table_name VARCHAR(64) NOT NULL,
    row_key VARCHAR(64) NOT NULL,
    op_type VARCHAR(16) NOT NULL,
    before_json TEXT,
    after_json TEXT,
    prev_hash VARCHAR(64) NOT NULL,
    curr_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);