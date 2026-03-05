/**
 * Task state machine — transitions + guards.
 * EXACT transitions from spec. No deviations.
 * @module domain/task-machine
 */

export const TASK_STATES = [
  'draft',
  'refined',
  'pending_approval',
  'approved',
  'auditing',
  'decomposing',
  'dispatched',
  'running',
  'sleeping',
  'done',
  'failed',
] as const;

export type TaskState = (typeof TASK_STATES)[number];

/** Valid state transitions — spec-exact + decomposer states */
const VALID_TRANSITIONS: Record<TaskState, readonly TaskState[]> = {
  draft:            ['refined', 'sleeping'],
  refined:          ['pending_approval', 'draft', 'sleeping'],
  pending_approval: ['approved', 'draft', 'sleeping'],
  approved:         ['auditing', 'dispatched', 'draft'],
  auditing:         ['decomposing', 'failed'],
  decomposing:      ['dispatched', 'failed'],
  dispatched:       ['running', 'failed'],
  running:          ['done', 'failed', 'sleeping'],
  sleeping:         ['draft'],
  done:             [],
  failed:           ['draft'],
} as const;

/** Terminal states — no transitions out */
export const TERMINAL_STATES: readonly TaskState[] = ['done'] as const;

/**
 * Check if a state transition is valid.
 * @param from - Current state
 * @param to - Target state
 * @returns Whether the transition is allowed
 */
export function canTransition(from: TaskState, to: TaskState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Get all valid target states from a given state.
 * @param from - Current state
 * @returns Array of valid target states
 */
export function validTransitions(from: TaskState): readonly TaskState[] {
  return VALID_TRANSITIONS[from];
}

/**
 * Check if a state is terminal (no outgoing transitions).
 * @param state - State to check
 * @returns Whether the state is terminal
 */
export function isTerminal(state: TaskState): boolean {
  return VALID_TRANSITIONS[state].length === 0;
}

/** Guard context for state transitions */
export interface TransitionGuardContext {
  failureReason?: string | null;
  aoSessionId?: string | null;
  projectId?: string | null;
  brief?: string | null;
}

/**
 * Validate transition guards.
 * @param to - Target state
 * @param ctx - Guard context with required fields
 * @returns Error message if guard fails, null if OK
 */
export function checkGuard(to: TaskState, ctx: TransitionGuardContext): string | null {
  if (to === 'failed' && !ctx.failureReason) {
    return 'Transition to failed requires failure_reason';
  }
  if (to === 'dispatched' && !ctx.aoSessionId) {
    return 'Transition to dispatched requires ao_session_id';
  }
  if (to === 'pending_approval' && !ctx.projectId) {
    return 'Transition to pending_approval requires project_id';
  }
  if (to === 'approved' && !ctx.brief) {
    return 'Transition to approved requires a non-empty brief';
  }
  return null;
}
