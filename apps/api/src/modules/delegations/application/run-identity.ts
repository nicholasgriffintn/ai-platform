export function delegationRunTaskId(delegationId: string, resumeAttempt?: number): string {
  return resumeAttempt
    ? `delegation_task_${delegationId}_resume_${resumeAttempt}`
    : `delegation_task_${delegationId}`;
}

export function delegationRunCommandId(delegationId: string, resumeAttempt?: number): string {
  return resumeAttempt
    ? `delegation_run_${delegationId}_resume_${resumeAttempt}`
    : `delegation_run_${delegationId}`;
}
