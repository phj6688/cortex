/**
 * Task state machine tests — validates ALL transitions, guards, and terminals.
 */

import { describe, it, expect } from 'vitest';
import {
  canTransition,
  checkGuard,
  isTerminal,
  validTransitions,
  TASK_STATES,
  type TaskState,
} from '../src/domain/task-machine.js';

describe('task-machine', () => {
  describe('valid transitions', () => {
    const cases: [TaskState, TaskState][] = [
      ['draft', 'refined'],
      ['draft', 'sleeping'],
      ['refined', 'pending_approval'],
      ['refined', 'draft'],
      ['refined', 'sleeping'],
      ['pending_approval', 'approved'],
      ['pending_approval', 'draft'],
      ['pending_approval', 'sleeping'],
      ['approved', 'dispatched'],
      ['approved', 'draft'],
      ['dispatched', 'running'],
      ['dispatched', 'failed'],
      ['running', 'done'],
      ['running', 'failed'],
      ['running', 'sleeping'],
      ['sleeping', 'draft'],
      ['failed', 'draft'],
    ];

    for (const [from, to] of cases) {
      it(`${from} → ${to} should be valid`, () => {
        expect(canTransition(from, to)).toBe(true);
      });
    }
  });

  describe('invalid transitions', () => {
    const cases: [TaskState, TaskState][] = [
      ['draft', 'approved'],
      ['draft', 'done'],
      ['draft', 'failed'],
      ['draft', 'running'],
      ['refined', 'approved'],
      ['refined', 'running'],
      ['pending_approval', 'running'],
      ['pending_approval', 'refined'],
      ['approved', 'running'],
      ['approved', 'failed'],
      ['approved', 'sleeping'],
      ['dispatched', 'done'],
      ['dispatched', 'sleeping'],
      ['dispatched', 'draft'],
      ['running', 'draft'],
      ['running', 'approved'],
      ['sleeping', 'running'],
      ['sleeping', 'approved'],
      ['sleeping', 'done'],
      ['done', 'draft'],
      ['done', 'running'],
      ['done', 'failed'],
      ['failed', 'running'],
      ['failed', 'approved'],
      ['failed', 'sleeping'],
    ];

    for (const [from, to] of cases) {
      it(`${from} → ${to} should be invalid`, () => {
        expect(canTransition(from, to)).toBe(false);
      });
    }
  });

  describe('terminal states', () => {
    it('done is terminal', () => {
      expect(isTerminal('done')).toBe(true);
    });

    it('failed is NOT terminal (can return to draft)', () => {
      expect(isTerminal('failed')).toBe(false);
    });

    it('sleeping is NOT terminal (can return to draft)', () => {
      expect(isTerminal('sleeping')).toBe(false);
    });

    it('running is NOT terminal', () => {
      expect(isTerminal('running')).toBe(false);
    });
  });

  describe('validTransitions', () => {
    it('done has no valid transitions', () => {
      expect(validTransitions('done')).toEqual([]);
    });

    it('draft can go to refined or sleeping', () => {
      expect(validTransitions('draft')).toEqual(['refined', 'sleeping']);
    });

    it('sleeping can only go to draft', () => {
      expect(validTransitions('sleeping')).toEqual(['draft']);
    });

    it('failed can only go to draft', () => {
      expect(validTransitions('failed')).toEqual(['draft']);
    });
  });

  describe('guards', () => {
    it('failed requires failure_reason', () => {
      const err = checkGuard('failed', { failureReason: null });
      expect(err).toBe('Transition to failed requires failure_reason');
    });

    it('failed passes with failure_reason', () => {
      const err = checkGuard('failed', { failureReason: 'Agent timed out' });
      expect(err).toBeNull();
    });

    it('dispatched requires ao_session_id', () => {
      const err = checkGuard('dispatched', { aoSessionId: null });
      expect(err).toBe('Transition to dispatched requires ao_session_id');
    });

    it('dispatched passes with ao_session_id', () => {
      const err = checkGuard('dispatched', { aoSessionId: 'sess_123' });
      expect(err).toBeNull();
    });

    it('pending_approval requires project_id', () => {
      const err = checkGuard('pending_approval', { projectId: null });
      expect(err).toBe('Transition to pending_approval requires project_id');
    });

    it('pending_approval passes with project_id', () => {
      const err = checkGuard('pending_approval', { projectId: 'prj_abc' });
      expect(err).toBeNull();
    });

    it('approved requires brief', () => {
      const err = checkGuard('approved', { brief: null });
      expect(err).toBe('Transition to approved requires a non-empty brief');
    });

    it('approved passes with brief', () => {
      const err = checkGuard('approved', { brief: '{"title":"test"}' });
      expect(err).toBeNull();
    });

    it('draft has no guards', () => {
      const err = checkGuard('draft', {});
      expect(err).toBeNull();
    });
  });

  describe('TASK_STATES', () => {
    it('contains exactly 9 states', () => {
      expect(TASK_STATES).toHaveLength(9);
    });

    it('includes all expected states', () => {
      const expected: TaskState[] = [
        'draft', 'refined', 'pending_approval', 'approved',
        'dispatched', 'running', 'sleeping', 'done', 'failed',
      ];
      for (const state of expected) {
        expect(TASK_STATES).toContain(state);
      }
    });
  });
});
