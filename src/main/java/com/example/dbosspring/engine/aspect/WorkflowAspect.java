package com.example.dbosspring.engine.aspect;

import com.example.dbosspring.engine.annotation.Step;
import com.example.dbosspring.engine.annotation.Workflow;
import com.example.dbosspring.engine.context.WorkflowContext;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.UUID;

@Aspect
@Component
public class WorkflowAspect {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public WorkflowAspect(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    // 1. Intercepts @Workflow methods
    @Around("@annotation(workflow)")
    public Object handleWorkflow(ProceedingJoinPoint joinPoint, Workflow workflow) throws Throwable {
        Object[] args = joinPoint.getArgs();
        // Use the first argument as workflowId if it's a String, otherwise generate a
        // UUID
        String workflowId = (args.length > 0 && args[0] instanceof String s && !s.isBlank())
                ? s
                : UUID.randomUUID().toString();

        String workflowName = workflow.name().isEmpty()
                ? joinPoint.getSignature().getName()
                : workflow.name();

        // Register workflow as PENDING in Postgres (or keep PENDING if resuming after a
        // crash)
       String inputJson = objectMapper.writeValueAsString(args);

       // Register workflow as PENDING in Postgres and store its input arguments
       // Register workflow as PENDING in Postgres and store its input arguments
        jdbcTemplate.update("""
                INSERT INTO workflow_status (workflow_id, workflow_name, status, input_json)
                VALUES (?, ?, 'PENDING', ?)
                ON CONFLICT (workflow_id) DO UPDATE
                SET status = 'PENDING',
                    input_json = EXCLUDED.input_json,
                    updated_at = CURRENT_TIMESTAMP
                """, workflowId, workflowName, inputJson);

        WorkflowContext.start(workflowId);
        System.out.println("\n🚀 [DBOS] Starting Workflow: " + workflowName + " (ID: " + workflowId + ")");

        try {
            Object result = joinPoint.proceed();

            // Mark workflow COMPLETED when all steps succeed
            jdbcTemplate.update("""
                    UPDATE workflow_status
                    SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
                    WHERE workflow_id = ?
                    """, workflowId);

            System.out.println("✅ [DBOS] Workflow COMPLETED: " + workflowId + "\n");
            return result;
        } catch (Throwable ex) {
            System.out.println("💥 [DBOS] Workflow CRASHED mid-flight (stays PENDING for recovery): " + workflowId
                    + " -> " + ex.getMessage() + "\n");
            throw ex;
        } finally {
            WorkflowContext.clear();
        }
    }

    // 2. Intercepts @Step methods
    @Around("@annotation(step)")
    public Object handleStep(ProceedingJoinPoint joinPoint, Step step) throws Throwable {
        String workflowId = WorkflowContext.getWorkflowId();
        if (workflowId == null) {
            // If called outside a workflow, just run normally
            return joinPoint.proceed();
        }

        int stepId = WorkflowContext.nextStepId();
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String stepName = step.name().isEmpty() ? signature.getName() : step.name();

        // Check if this step already completed before a crash
        List<String> existingOutput = jdbcTemplate.queryForList("""
                SELECT output_json FROM step_outputs
                WHERE workflow_id = ? AND step_id = ?
                """, String.class, workflowId, stepId);

        if (!existingOutput.isEmpty()) {
            System.out.println("⏩ [DBOS] Step " + stepId + " (" + stepName
                    + ") already completed! Skipping & returning saved checkpoint.");
            String json = existingOutput.getFirst();
            Class<?> returnType = signature.getReturnType();
            if (returnType.equals(void.class) || returnType.equals(Void.class) || json == null) {
                return null;
            }
            return objectMapper.readValue(json, returnType);
        }

        // Otherwise, run the step for the first time and save the checkpoint
        System.out.println("▶️ [DBOS] Executing Step " + stepId + " (" + stepName + ")...");
        Object result = joinPoint.proceed();

        String outputJson = (result != null) ? objectMapper.writeValueAsString(result) : null;
        jdbcTemplate.update("""
                INSERT INTO step_outputs (workflow_id, step_id, step_name, output_json)
                VALUES (?, ?, ?, ?)
                """, workflowId, stepId, stepName, outputJson);

        return result;
    }
}