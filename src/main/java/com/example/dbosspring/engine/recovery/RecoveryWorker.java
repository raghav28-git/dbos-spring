package com.example.dbosspring.engine.recovery;

import com.example.dbosspring.demo.TransferWorkflowService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

@Component
public class RecoveryWorker {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final TransferWorkflowService transferService;

    public RecoveryWorker(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper,
            TransferWorkflowService transferService) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.transferService = transferService;
    }

    @Scheduled(fixedDelay = 5000)
    @Transactional
    public void recoverPendingWorkflows() {
        // Claim stuck PENDING workflows safely using FOR UPDATE SKIP LOCKED
        List<Map<String, Object>> stuckWorkflows = jdbcTemplate.queryForList("""
                SELECT workflow_id, input_json
                FROM workflow_status
                WHERE status = 'PENDING'
                  AND updated_at < CURRENT_TIMESTAMP - INTERVAL '5 seconds'
                FOR UPDATE SKIP LOCKED
                """);

        for (Map<String, Object> row : stuckWorkflows) {
            String workflowId = (String) row.get("workflow_id");
            String inputJson = (String) row.get("input_json");
            if (inputJson == null)
                continue;

            try {
                System.out.println(
                        "🔄 [DBOS-RECOVERY] Found stuck PENDING workflow: " + workflowId + ". Auto-resuming...");
                Object[] args = objectMapper.readValue(inputJson, Object[].class);
                String fromUser = (String) args[1];
                String toUser = (String) args[2];
                int amount = ((Number) args[3]).intValue();

                // Re-run with simulateCrash = false so it finishes cleanly
                transferService.transferMoney(workflowId, fromUser, toUser, amount, false);
            } catch (Exception e) {
                System.out.println("⚠️ [DBOS-RECOVERY] Failed to recover " + workflowId + ": " + e.getMessage());
            }
        }
    }
}