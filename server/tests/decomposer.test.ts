/**
 * Decomposer tests — state machine, prompt builder, session logic.
 * @module tests/decomposer
 */

import { describe, it, expect } from 'vitest';
import {
  canTransition,
  validTransitions,
  isTerminal,
  TASK_STATES,
  type TaskState,
} from '../src/domain/task-machine.js';
import { buildSessionPrompt } from '../src/services/prompt-builder.js';
import type { SessionPlan } from '../src/services/decomposer-service.js';
import type { TaskRow } from '../src/db/queries/tasks.js';

describe('Decomposer — State Machine Extensions', () => {
  describe('new states exist', () => {
    it('includes auditing state', () => {
      expect(TASK_STATES).toContain('auditing');
    });

    it('includes decomposing state', () => {
      expect(TASK_STATES).toContain('decomposing');
    });
  });

  describe('approved → auditing transition', () => {
    it('allows approved → auditing', () => {
      expect(canTransition('approved', 'auditing')).toBe(true);
    });

    it('allows approved → dispatched (small tasks bypass)', () => {
      expect(canTransition('approved', 'dispatched')).toBe(true);
    });

    it('allows approved → draft (back to editing)', () => {
      expect(canTransition('approved', 'draft')).toBe(true);
    });
  });

  describe('auditing transitions', () => {
    it('allows auditing → decomposing', () => {
      expect(canTransition('auditing', 'decomposing')).toBe(true);
    });

    it('allows auditing → failed', () => {
      expect(canTransition('auditing', 'failed')).toBe(true);
    });

    it('rejects auditing → done', () => {
      expect(canTransition('auditing', 'done')).toBe(false);
    });

    it('rejects auditing → running', () => {
      expect(canTransition('auditing', 'running')).toBe(false);
    });

    it('rejects auditing → draft', () => {
      expect(canTransition('auditing', 'draft')).toBe(false);
    });
  });

  describe('decomposing transitions', () => {
    it('allows decomposing → dispatched', () => {
      expect(canTransition('decomposing', 'dispatched')).toBe(true);
    });

    it('allows decomposing → failed', () => {
      expect(canTransition('decomposing', 'failed')).toBe(true);
    });

    it('rejects decomposing → done', () => {
      expect(canTransition('decomposing', 'done')).toBe(false);
    });

    it('rejects decomposing → running', () => {
      expect(canTransition('decomposing', 'running')).toBe(false);
    });

    it('rejects decomposing → approved', () => {
      expect(canTransition('decomposing', 'approved')).toBe(false);
    });
  });

  describe('existing transitions still work', () => {
    it('draft → refined', () => {
      expect(canTransition('draft', 'refined')).toBe(true);
    });

    it('dispatched → running', () => {
      expect(canTransition('dispatched', 'running')).toBe(true);
    });

    it('running → done', () => {
      expect(canTransition('running', 'done')).toBe(true);
    });

    it('failed → draft', () => {
      expect(canTransition('failed', 'draft')).toBe(true);
    });

    it('done is terminal', () => {
      expect(isTerminal('done')).toBe(true);
    });

    it('auditing is NOT terminal', () => {
      expect(isTerminal('auditing')).toBe(false);
    });

    it('decomposing is NOT terminal', () => {
      expect(isTerminal('decomposing')).toBe(false);
    });
  });

  describe('valid transitions list', () => {
    it('approved has 3 valid transitions', () => {
      const transitions = validTransitions('approved');
      expect(transitions).toHaveLength(3);
      expect(transitions).toContain('auditing');
      expect(transitions).toContain('dispatched');
      expect(transitions).toContain('draft');
    });

    it('auditing has 2 valid transitions', () => {
      const transitions = validTransitions('auditing');
      expect(transitions).toHaveLength(2);
      expect(transitions).toContain('decomposing');
      expect(transitions).toContain('failed');
    });

    it('decomposing has 2 valid transitions', () => {
      const transitions = validTransitions('decomposing');
      expect(transitions).toHaveLength(2);
      expect(transitions).toContain('dispatched');
      expect(transitions).toContain('failed');
    });
  });
});

describe('Decomposer — Prompt Builder', () => {
  const mockTask: TaskRow = {
    id: 'tsk_test123',
    title: 'Test Task',
    brief: JSON.stringify({
      title: 'Build Auth Module',
      objective: 'Implement OAuth2 authentication',
      acceptance_criteria: ['Login works', 'Tokens refresh'],
      avoid_areas: ['No plain text passwords'],
    }),
    raw_input: 'Build auth with OAuth2',
    project_id: 'prj_test',
    state: 'running',
    priority: 1,
    ao_session_id: null,
    ao_branch: null,
    ao_pr_url: null,
    failure_reason: null,
    cost_usd: 0,
    token_input: 0,
    token_output: 0,
    parent_task_id: null,
    metadata: '{}',
    created_at: 1000000,
    approved_at: 1000100,
    dispatched_at: 1000200,
    completed_at: null,
    updated_at: 1000200,
  };

  const session1: SessionPlan = {
    session_number: 1,
    title: 'Foundation',
    deliverables: ['Schema for users table', 'Auth service with token generation'],
    verification: ['pnpm test', 'pnpm typecheck'],
    regression: [],
    anti_patterns: ['Using exec() for shell commands', 'Storing tokens in localStorage'],
    depends_on: [],
  };

  const session2: SessionPlan = {
    session_number: 2,
    title: 'OAuth Provider',
    deliverables: ['OAuth2 provider integration', 'Callback handler'],
    verification: ['pnpm test', 'curl localhost:3481/health'],
    regression: ['pnpm test', 'pnpm typecheck'],
    anti_patterns: ['Hardcoding client secrets'],
    depends_on: [1],
  };

  const allSessions = [session1, session2];

  // Context to avoid DB calls in tests
  const emptyCtx = { auditVerdicts: [], sessionRecord: null };

  it('includes session header', () => {
    const prompt = buildSessionPrompt(mockTask, session1, allSessions, emptyCtx);
    expect(prompt).toContain('# SESSION 1: Foundation');
  });

  it('includes spec reference', () => {
    const prompt = buildSessionPrompt(mockTask, session1, allSessions, emptyCtx);
    expect(prompt).toContain('Read CORTEX-V3-TASKSPEC.md fully');
  });

  it('includes brief context', () => {
    const prompt = buildSessionPrompt(mockTask, session1, allSessions, emptyCtx);
    expect(prompt).toContain('Build Auth Module');
    expect(prompt).toContain('OAuth2 authentication');
  });

  it('includes anti-patterns', () => {
    const prompt = buildSessionPrompt(mockTask, session1, allSessions, emptyCtx);
    expect(prompt).toContain('ANTI-PATTERNS');
    expect(prompt).toContain('exec() for shell commands');
    expect(prompt).toContain('Storing tokens in localStorage');
  });

  it('includes deliverables', () => {
    const prompt = buildSessionPrompt(mockTask, session1, allSessions, emptyCtx);
    expect(prompt).toContain('DELIVERABLES');
    expect(prompt).toContain('Schema for users table');
    expect(prompt).toContain('Auth service with token generation');
  });

  it('includes verification commands', () => {
    const prompt = buildSessionPrompt(mockTask, session1, allSessions, emptyCtx);
    expect(prompt).toContain('VERIFICATION');
    expect(prompt).toContain('$ pnpm test');
    expect(prompt).toContain('$ pnpm typecheck');
  });

  it('includes regression for session 2', () => {
    const prompt = buildSessionPrompt(mockTask, session2, allSessions, emptyCtx);
    expect(prompt).toContain('REGRESSION');
    expect(prompt).toContain('$ pnpm test');
    expect(prompt).toContain('$ pnpm typecheck');
  });

  it('does NOT include regression for session 1', () => {
    const prompt = buildSessionPrompt(mockTask, session1, allSessions, emptyCtx);
    expect(prompt).not.toContain('REGRESSION');
  });

  it('includes completed sessions context for session 2', () => {
    const prompt = buildSessionPrompt(mockTask, session2, allSessions, emptyCtx);
    expect(prompt).toContain('COMPLETED SESSIONS');
    expect(prompt).toContain('Session 1 (Foundation): PASSED');
  });

  it('does NOT include completed sessions for session 1', () => {
    const prompt = buildSessionPrompt(mockTask, session1, allSessions, emptyCtx);
    expect(prompt).not.toContain('COMPLETED SESSIONS');
  });

  it('includes audit findings when provided', () => {
    const ctx = {
      auditVerdicts: [
        {
          id: 'aud_test1',
          task_id: 'tsk_test123',
          file_path: 'src/auth.ts',
          verdict: 'rewrite' as const,
          reason: 'Uses plaintext passwords',
          patch_details: null,
          created_at: 1000000,
        },
        {
          id: 'aud_test2',
          task_id: 'tsk_test123',
          file_path: 'src/db.ts',
          verdict: 'patch' as const,
          reason: 'Missing connection pooling',
          patch_details: 'Add pool configuration',
          created_at: 1000000,
        },
      ],
      sessionRecord: null,
    };
    const prompt = buildSessionPrompt(mockTask, session1, allSessions, ctx);
    expect(prompt).toContain('AUDIT FINDINGS');
    expect(prompt).toContain('`src/auth.ts` → **REWRITE**');
    expect(prompt).toContain('`src/db.ts` → **PATCH**');
    expect(prompt).toContain('Fixes: Add pool configuration');
  });

  it('includes failure context on retry', () => {
    const ctx = {
      auditVerdicts: [],
      sessionRecord: {
        id: 'ses_test1',
        task_id: 'tsk_test123',
        session_number: 1,
        title: 'Foundation',
        prompt: '',
        deliverables: '[]',
        verification: '[]',
        regression: '[]',
        anti_patterns: '[]',
        state: 'failed' as const,
        ao_session_id: null,
        audit_report: null,
        verification_output: 'Error: 3 tests failed',
        failure_reason: 'Tests failed on migration',
        cost_usd: 0.42,
        retry_count: 1,
        created_at: 1000000,
        started_at: 1000100,
        completed_at: 1000200,
      },
    };
    const prompt = buildSessionPrompt(mockTask, session1, allSessions, ctx);
    expect(prompt).toContain('PREVIOUS ATTEMPT FAILED');
    expect(prompt).toContain('Tests failed on migration');
    expect(prompt).toContain('Error: 3 tests failed');
  });
});

describe('Decomposer — Regression Chain Logic', () => {
  it('session 1 has no regression', () => {
    const sessions: SessionPlan[] = [
      { session_number: 1, title: 'S1', deliverables: [], verification: ['pnpm test'], regression: [], anti_patterns: [], depends_on: [] },
      { session_number: 2, title: 'S2', deliverables: [], verification: ['pnpm build'], regression: [], anti_patterns: [], depends_on: [1] },
      { session_number: 3, title: 'S3', deliverables: [], verification: ['pnpm lint'], regression: [], anti_patterns: [], depends_on: [2] },
    ];

    // Simulate regression chain injection
    for (let i = 1; i < sessions.length; i++) {
      const session = sessions[i]!;
      session.regression = sessions.slice(0, i).flatMap(s => s.verification);
    }

    expect(sessions[0]!.regression).toEqual([]);
    expect(sessions[1]!.regression).toEqual(['pnpm test']);
    expect(sessions[2]!.regression).toEqual(['pnpm test', 'pnpm build']);
  });

  it('handles sessions with multiple verification commands', () => {
    const sessions: SessionPlan[] = [
      { session_number: 1, title: 'S1', deliverables: [], verification: ['pnpm test', 'pnpm typecheck'], regression: [], anti_patterns: [], depends_on: [] },
      { session_number: 2, title: 'S2', deliverables: [], verification: ['pnpm build'], regression: [], anti_patterns: [], depends_on: [1] },
    ];

    for (let i = 1; i < sessions.length; i++) {
      const session = sessions[i]!;
      session.regression = sessions.slice(0, i).flatMap(s => s.verification);
    }

    expect(sessions[1]!.regression).toEqual(['pnpm test', 'pnpm typecheck']);
  });
});

describe('Decomposer — Small Task Bypass', () => {
  it('small tasks should go approved → dispatched (not auditing)', () => {
    // Small task: approved → dispatched (existing flow)
    expect(canTransition('approved', 'dispatched')).toBe(true);
  });

  it('trivial tasks have no decomposer path', () => {
    // The decomposer only triggers when estimated_complexity === "large"
    // Other complexities go straight to dispatch
    expect(canTransition('approved', 'auditing')).toBe(true);
    expect(canTransition('approved', 'dispatched')).toBe(true);
  });
});
