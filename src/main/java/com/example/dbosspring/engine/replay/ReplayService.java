package com.example.dbosspring.engine.replay;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ReplayService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public ReplayService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    // Time-Travel to a past workflow, reconstruct balances before it ran, and
    // replay in a sandbox
    public Map<String, Object> replayWorkflow(String workflowId) {
        var wfRows = jdbcTemplate.queryForList(
                "SELECT * FROM workflow_status WHERE workflow_id = ?", workflowId);
        if (wfRows.isEmpty()) {
            return Map.of("error", "Workflow not found: " + workflowId);
        }

        Map<String, Object> wf = wfRows.getFirst();
        var steps = jdbcTemplate.queryForList(
                "SELECT step_id, step_name, output_json, completed_at FROM step_outputs WHERE workflow_id = ? ORDER BY step_id ASC",
                workflowId);
        var provEvents = jdbcTemplate.queryForList(
                "SELECT event_id, step_id, row_key, op_type, before_json, after_json, curr_hash FROM provenance_events WHERE workflow_id = ? ORDER BY event_id ASC",
                workflowId);

        // 1. Reconstruct historical balances BEFORE and AFTER this workflow from
        // provenance logs
        Map<String, Integer> stateBefore = new LinkedHashMap<>();
        Map<String, Integer> recordedStateAfter = new LinkedHashMap<>();

        for (Map<String, Object> ev : provEvents) {
            String user = (String) ev.get("row_key");
            int beforeBal = extractBalance((String) ev.get("before_json"));
            int afterBal = extractBalance((String) ev.get("after_json"));

            // First time we see a user in this workflow is their true starting balance
            // before the workflow
            stateBefore.putIfAbsent(user, beforeBal);
            recordedStateAfter.put(user, afterBal);
        }

        // 2. Sandbox Replay: re-execute the transfer math on a clone of stateBefore
        // without touching Postgres
        Map<String, Integer> sandboxState = new LinkedHashMap<>(stateBefore);
        String inputJson = (String) wf.get("input_json");
        int transferAmount = 0;
        String fromUser = "";
        String toUser = "";

        if (inputJson != null) {
            try {
                Object[] args = objectMapper.readValue(inputJson, Object[].class);
                fromUser = (String) args[1];
                toUser = (String) args[2];
                transferAmount = ((Number) args[3]).intValue();

                if (sandboxState.containsKey(fromUser)) {
                    sandboxState.put(fromUser, sandboxState.get(fromUser) - transferAmount);
                }
                if (sandboxState.containsKey(toUser)) {
                    sandboxState.put(toUser, sandboxState.get(toUser) + transferAmount);
                }
            } catch (Exception e) {
                throw new RuntimeException("Failed to parse workflow input_json for replay", e);
            }
        }

        boolean deterministicMatch = sandboxState.equals(recordedStateAfter);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("workflowId", workflowId);
        result.put("workflowStatus", wf.get("status"));
        result.put("transferDetails", Map.of("from", fromUser, "to", toUser, "amount", transferAmount));
        result.put("historicalStateBefore", stateBefore);
        result.put("recordedStateAfter", recordedStateAfter);
        result.put("sandboxReplayedStateAfter", sandboxState);
        result.put("deterministicMatch", deterministicMatch);
        result.put("checkpointedSteps", steps);
        result.put("provenanceTimeline", provEvents);
        return result;
    }

    private int extractBalance(String json) {
        try {
            var node = objectMapper.readTree(json);
            return node.get("balance").asInt();
        } catch (Exception e) {
            return 0;
        }
    }
}