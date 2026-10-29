package com.example.dbosspring.demo;

import com.example.dbosspring.engine.provenance.ProvenanceService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class TransferController {

    private final TransferWorkflowService transferService;
    private final ProvenanceService provenanceService;
    private final JdbcTemplate jdbcTemplate;

    public TransferController(TransferWorkflowService transferService,
                              ProvenanceService provenanceService,
                              JdbcTemplate jdbcTemplate) {
        this.transferService = transferService;
        this.provenanceService = provenanceService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @RequestMapping(value = "/transfer", method = {RequestMethod.GET, RequestMethod.POST})
    public Map<String, Object> transfer(
            @RequestParam String workflowId,
            @RequestParam(defaultValue = "alice") String from,
            @RequestParam(defaultValue = "bob") String to,
            @RequestParam(defaultValue = "100") int amount,
            @RequestParam(defaultValue = "false") boolean crash
    ) {
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

    // Verify SHA-256 hash chain integrity
    @GetMapping("/verify")
    public Map<String, Object> verifyIntegrity() {
        return provenanceService.verifyHashChain();
    }

    // Simulate a database hack: secretly alter a historical row in provenance_events
    @RequestMapping(value = "/tamper", method = {RequestMethod.GET, RequestMethod.POST})
    public Map<String, Object> simulateTamper() {
        jdbcTemplate.update("""
                UPDATE provenance_events
                SET after_json = '{"balance":999999}'
                WHERE event_id = (SELECT MIN(event_id) FROM provenance_events)
                """);
        return Map.of(
                "message", "Simulated database tampering on the first provenance record!",
                "verificationResult", provenanceService.verifyHashChain()
        );
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