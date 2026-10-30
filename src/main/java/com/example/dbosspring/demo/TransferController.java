package com.example.dbosspring.demo;

import com.example.dbosspring.engine.provenance.ProvenanceService;
import com.example.dbosspring.engine.replay.ReplayService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class TransferController {

    private final TransferWorkflowService transferService;
    private final ProvenanceService provenanceService;
    private final ReplayService replayService;
    private final JdbcTemplate jdbcTemplate;

    public TransferController(TransferWorkflowService transferService,
            ProvenanceService provenanceService,
            ReplayService replayService,
            JdbcTemplate jdbcTemplate) {
        this.transferService = transferService;
        this.provenanceService = provenanceService;
        this.replayService = replayService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @RequestMapping(value = "/transfer", method = { RequestMethod.GET, RequestMethod.POST })
    public Map<String, Object> transfer(
            @RequestParam String workflowId,
            @RequestParam(defaultValue = "alice") String from,
            @RequestParam(defaultValue = "bob") String to,
            @RequestParam(defaultValue = "100") int amount,
            @RequestParam(defaultValue = "false") boolean crash) {
        Map<String, Object> response = new LinkedHashMap<>();
        try {
            String result = transferService.transferMoney(workflowId, from, to, amount, crash);
            response.put("status", "SUCCESS");
            response.put("message", result);
        } catch (Exception e) {
            response.put("status", "CRASHED");
            response.put("error", e.getMessage());
        }
        response.put("accounts", jdbcTemplate.queryForList("SELECT * FROM accounts ORDER BY username"));
        return response;
    }

    // Time-Travel Replay endpoint (Phase 4)
    @GetMapping("/replay")
    public Map<String, Object> replay(@RequestParam String workflowId) {
        return replayService.replayWorkflow(workflowId);
    }

    // Verify SHA-256 hash chain integrity
    @GetMapping("/verify")
    public Map<String, Object> verifyIntegrity() {
        return provenanceService.verifyHashChain();
    }

    // Simulate a database hack
    @RequestMapping(value = "/tamper", method = { RequestMethod.GET, RequestMethod.POST })
    public Map<String, Object> simulateTamper() {
        jdbcTemplate.update("""
                UPDATE provenance_events
                SET after_json = '{"balance":999999}'
                WHERE event_id = (SELECT MIN(event_id) FROM provenance_events)
                """);
        return Map.of(
                "message", "Simulated database tampering on the first provenance record!",
                "verificationResult", provenanceService.verifyHashChain());
    }

    // Reset all tables cleanly back to Alice ($1000) and Bob ($1000)
    @RequestMapping(value = "/reset", method = { RequestMethod.GET, RequestMethod.POST })
    public Map<String, Object> resetSystem() {
        jdbcTemplate.update("DELETE FROM provenance_events");
        jdbcTemplate.update("DELETE FROM step_outputs");
        jdbcTemplate.update("DELETE FROM workflow_status");
        jdbcTemplate.update("UPDATE accounts SET balance = 1000 WHERE username IN ('alice', 'bob')");
        return Map.of(
                "message", "System reset to clean state (Alice: $1000, Bob: $1000)",
                "accounts", jdbcTemplate.queryForList("SELECT * FROM accounts ORDER BY username"));
    }

    @GetMapping("/state")
    public Map<String, Object> getState() {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("integrity", provenanceService.verifyHashChain());
        state.put("accounts", jdbcTemplate.queryForList("SELECT * FROM accounts ORDER BY username"));
        state.put("workflows", jdbcTemplate.queryForList("SELECT * FROM workflow_status ORDER BY created_at DESC"));
        state.put("steps", jdbcTemplate.queryForList("SELECT * FROM step_outputs ORDER BY workflow_id, step_id"));
        state.put("provenance", jdbcTemplate.queryForList("SELECT * FROM provenance_events ORDER BY event_id DESC"));
        return state;
    }
}