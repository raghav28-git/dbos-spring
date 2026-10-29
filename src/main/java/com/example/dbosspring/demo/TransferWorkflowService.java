package com.example.dbosspring.demo;

import com.example.dbosspring.engine.annotation.Step;
import com.example.dbosspring.engine.annotation.Workflow;
import com.example.dbosspring.engine.provenance.ProvenanceService;
import org.springframework.context.annotation.Lazy;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class TransferWorkflowService {

    private final JdbcTemplate jdbcTemplate;
    private final ProvenanceService provenanceService;
    private final TransferWorkflowService self;

    public TransferWorkflowService(JdbcTemplate jdbcTemplate,
                                   ProvenanceService provenanceService,
                                   @Lazy TransferWorkflowService self) {
        this.jdbcTemplate = jdbcTemplate;
        this.provenanceService = provenanceService;
        this.self = self;
    }

    @Workflow(name = "moneyTransfer")
    public String transferMoney(String workflowId, String fromUser, String toUser, int amount, boolean simulateCrash) {
        // Step 1: Deduct from sender
        self.deduct(fromUser, amount);

        // 💥 Crash Switch: Simulate server dying right after money is deducted!
        if (simulateCrash) {
            throw new RuntimeException("SERVER CRASHED right after deducting $" + amount + " from " + fromUser + "!");
        }

        // Step 2: Run Fraud Check
        String fraudStatus = self.fraudCheck(fromUser, toUser, amount);

        // Step 3: Credit receiver
        self.credit(toUser, amount);

        return "Transfer " + workflowId + " succeeded (" + fraudStatus + ")";
    }

    @Step(name = "deduct")
    public String deduct(String username, int amount) {
        Integer before = jdbcTemplate.queryForObject(
                "SELECT balance FROM accounts WHERE username = ?", Integer.class, username);

        jdbcTemplate.update(
                "UPDATE accounts SET balance = balance - ? WHERE username = ?", amount, username);

        Integer after = jdbcTemplate.queryForObject(
                "SELECT balance FROM accounts WHERE username = ?", Integer.class, username);

        provenanceService.recordRowChange(
                "accounts", username, "UPDATE",
                "{\"balance\":" + before + "}",
                "{\"balance\":" + after + "}"
        );

        return "Deducted $" + amount + " from " + username;
    }

    @Step(name = "fraudCheck")
    public String fraudCheck(String fromUser, String toUser, int amount) {
        if (amount > 10000) {
            throw new IllegalArgumentException("Fraud alert: amount exceeds limit!");
        }
        return "FRAUD_CHECK_PASSED";
    }

    @Step(name = "credit")
    public String credit(String username, int amount) {
        Integer before = jdbcTemplate.queryForObject(
                "SELECT balance FROM accounts WHERE username = ?", Integer.class, username);

        jdbcTemplate.update(
                "UPDATE accounts SET balance = balance + ? WHERE username = ?", amount, username);

        Integer after = jdbcTemplate.queryForObject(
                "SELECT balance FROM accounts WHERE username = ?", Integer.class, username);

        provenanceService.recordRowChange(
                "accounts", username, "UPDATE",
                "{\"balance\":" + before + "}",
                "{\"balance\":" + after + "}"
        );

        return "Credited $" + amount + " to " + username;
    }
}