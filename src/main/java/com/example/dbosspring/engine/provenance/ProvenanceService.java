package com.example.dbosspring.engine.provenance;

import com.example.dbosspring.engine.context.WorkflowContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ProvenanceService {

    private final JdbcTemplate jdbcTemplate;

    public ProvenanceService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // Records before/after row state and links it to the SHA-256 hash chain
    public void recordRowChange(String tableName, String rowKey, String opType, String beforeJson, String afterJson) {
        String workflowId = WorkflowContext.getWorkflowId();
        int stepId = WorkflowContext.getCurrentStepId();
        if (workflowId == null) {
            workflowId = "MANUAL_OUTSIDE_WORKFLOW";
        }

        List<String> lastHashes = jdbcTemplate.queryForList(
                "SELECT curr_hash FROM provenance_events ORDER BY event_id DESC LIMIT 1",
                String.class);
        String prevHash = lastHashes.isEmpty() ? "GENESIS_00000000000000000000000000000000" : lastHashes.getFirst();

        String currHash = computeSha256(prevHash, workflowId, stepId, tableName, rowKey, opType, beforeJson, afterJson);

        jdbcTemplate.update("""
                INSERT INTO provenance_events
                (workflow_id, step_id, table_name, row_key, op_type, before_json, after_json, prev_hash, curr_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, workflowId, stepId, tableName, rowKey, opType, beforeJson, afterJson, prevHash, currHash);

        System.out.println("🔒 [PROVENANCE] Logged " + tableName + "[" + rowKey + "] " + beforeJson + " -> " + afterJson
                + " | Hash: " + currHash.substring(0, 12) + "...");
    }

    // Verifies the entire provenance table to detect if anyone tampered with historical rows
    public Map<String, Object> verifyHashChain() {
        var events = jdbcTemplate.queryForList(
                "SELECT * FROM provenance_events ORDER BY event_id ASC"
        );

        String expectedPrevHash = "GENESIS_00000000000000000000000000000000";
        for (Map<String, Object> ev : events) {
            int eventId = ((Number) ev.get("event_id")).intValue();
            String workflowId = (String) ev.get("workflow_id");
            int stepId = ((Number) ev.get("step_id")).intValue();
            String tableName = (String) ev.get("table_name");
            String rowKey = (String) ev.get("row_key");
            String opType = (String) ev.get("op_type");
            String beforeJson = (String) ev.get("before_json");
            String afterJson = (String) ev.get("after_json");
            String storedPrevHash = (String) ev.get("prev_hash");
            String storedCurrHash = (String) ev.get("curr_hash");

            String recalculatedHash = computeSha256(
                    expectedPrevHash, workflowId, stepId, tableName, rowKey, opType, beforeJson, afterJson
            );

            if (!expectedPrevHash.equals(storedPrevHash) || !recalculatedHash.equals(storedCurrHash)) {
                Map<String, Object> alert = new LinkedHashMap<>();
                alert.put("valid", false);
                alert.put("status", "TAMPER_DETECTED");
                alert.put("tamperedEventId", eventId);
                alert.put("workflowId", workflowId);
                alert.put("expectedHash", recalculatedHash);
                alert.put("actualStoredHash", storedCurrHash);
                return alert;
            }
            expectedPrevHash = storedCurrHash;
        }

        Map<String, Object> ok = new LinkedHashMap<>();
        ok.put("valid", true);
        ok.put("status", "INTEGRITY_VERIFIED");
        ok.put("totalEventsChecked", events.size());
        return ok;
    }

    private String computeSha256(String prevHash, String workflowId, int stepId, String tableName,
            String rowKey, String opType, String beforeJson, String afterJson) {
        try {
            String payload = String.join("|",
                    prevHash, workflowId, String.valueOf(stepId),
                    tableName, rowKey, opType,
                    String.valueOf(beforeJson), String.valueOf(afterJson));
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (Exception e) {
            throw new RuntimeException("Failed to compute SHA-256 hash", e);
        }
    }
}