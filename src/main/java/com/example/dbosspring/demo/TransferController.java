package com.example.dbosspring.demo;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class TransferController {

    private final TransferWorkflowService transferService;
    private final JdbcTemplate jdbcTemplate;

    public TransferController(TransferWorkflowService transferService, JdbcTemplate jdbcTemplate) {
        this.transferService = transferService;
        this.jdbcTemplate = jdbcTemplate;
    }

    // Trigger a transfer (works directly in your browser address bar!)
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

    // View current balances, workflows, and checkpoints
    @GetMapping("/state")
    public Map<String, Object> getState() {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("accounts", jdbcTemplate.queryForList("SELECT * FROM accounts ORDER BY username"));
        state.put("workflows", jdbcTemplate.queryForList("SELECT * FROM workflow_status ORDER BY created_at DESC"));
        state.put("steps", jdbcTemplate.queryForList("SELECT * FROM step_outputs ORDER BY workflow_id, step_id"));
        return state;
    }
}