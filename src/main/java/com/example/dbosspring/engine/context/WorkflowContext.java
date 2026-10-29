package com.example.dbosspring.engine.context;

public class WorkflowContext {

    private static final ThreadLocal<String> currentWorkflowId = new ThreadLocal<>();
    private static final ThreadLocal<Integer> stepCounter = ThreadLocal.withInitial(() -> 0);

    public static void start(String workflowId) {
        currentWorkflowId.set(workflowId);
        stepCounter.set(0);
    }

    public static String getWorkflowId() {
        return currentWorkflowId.get();
    }

    public static int nextStepId() {
        int next = stepCounter.get() + 1;
        stepCounter.set(next);
        return next;
    }

    public static int getCurrentStepId() {
        return stepCounter.get();
    }

    public static void clear() {
        currentWorkflowId.remove();
        stepCounter.remove();
    }
}