/**
 * Brief refiner tests — validates parsing + user message building.
 * Tests all 3 spec behaviors: clear intent, clarification, ops task.
 */

import { describe, it, expect } from 'vitest';
import {
  buildUserMessage,
  parseLLMResponse,
  SYSTEM_PROMPT,
} from '../src/services/brief-refiner.js';

describe('brief-refiner', () => {
  describe('SYSTEM_PROMPT', () => {
    it('contains permission-framing rule', () => {
      expect(SYSTEM_PROMPT).toContain('asking PERMISSION');
    });

    it('specifies 8 word max title', () => {
      expect(SYSTEM_PROMPT).toContain('8 words max');
    });

    it('mentions estimated_complexity', () => {
      expect(SYSTEM_PROMPT).toContain('estimated_complexity');
    });

    it('mentions suggested_project', () => {
      expect(SYSTEM_PROMPT).toContain('suggested_project');
    });

    it('specifies ops tasks skip questions', () => {
      expect(SYSTEM_PROMPT).toContain('Ops/infra tasks ALWAYS skip questions');
    });
  });

  describe('buildUserMessage', () => {
    it('builds basic message from input', () => {
      const msg = buildUserMessage('Fix the login bug');
      expect(msg).toBe('User intent: Fix the login bug');
    });

    it('includes context when provided', () => {
      const msg = buildUserMessage('Fix the bug', 'In the auth module');
      expect(msg).toContain('Additional context: In the auth module');
    });

    it('includes numbered answers', () => {
      const msg = buildUserMessage('Refactor auth', undefined, ['preserve tokens', 'use JWT']);
      expect(msg).toContain('1. preserve tokens');
      expect(msg).toContain('2. use JWT');
    });

    it('includes both context and answers', () => {
      const msg = buildUserMessage('Fix it', 'In prod', ['yes']);
      expect(msg).toContain('Additional context: In prod');
      expect(msg).toContain('1. yes');
    });
  });

  describe('parseLLMResponse', () => {
    describe('Example A — Clear intent, zero questions', () => {
      it('parses a direct brief with no questions', () => {
        const rawText = JSON.stringify({
          questions: null,
          brief: {
            title: 'Fix mobile Safari login bug',
            objective: 'Login button invisible on Safari iOS. Restore without regressing other browsers.',
            acceptance_criteria: ['Visible on Safari iOS 17+', 'No regression Chrome/Firefox', 'Screenshot proof'],
            avoid_areas: [],
            estimated_complexity: 'small',
            suggested_project: null,
          },
        });

        const result = parseLLMResponse(rawText, 'Fix the bug');
        expect(result.type).toBe('brief');
        if (result.type === 'brief') {
          expect(result.content.title).toBe('Fix mobile Safari login bug');
          expect(result.content.acceptance_criteria).toHaveLength(3);
          expect(result.content.estimated_complexity).toBe('small');
          expect(result.content.avoid_areas).toEqual([]);
        }
      });
    });

    describe('Example B — One clarification', () => {
      it('parses questions response', () => {
        const rawText = JSON.stringify({
          questions: [
            'Should I preserve the existing session token format, or is breaking backward compatibility with active sessions acceptable?',
          ],
          brief: null,
        });

        const result = parseLLMResponse(rawText, 'refactor auth');
        expect(result.type).toBe('questions');
        if (result.type === 'questions') {
          expect(result.content).toHaveLength(1);
          expect(result.content[0]).toContain('session token format');
        }
      });

      it('parses follow-up brief after answers', () => {
        const rawText = JSON.stringify({
          questions: null,
          brief: {
            title: 'Refactor auth, preserve tokens',
            objective: 'Clean up auth internals. No JWT format changes. No active sessions invalidated.',
            acceptance_criteria: ['All auth tests pass', 'No JWT format changes', 'Complexity reduced 30%+'],
            avoid_areas: ['token signing logic', 'session schema migrations'],
            estimated_complexity: 'medium',
            suggested_project: null,
          },
        });

        const result = parseLLMResponse(rawText, 'refactor auth');
        expect(result.type).toBe('brief');
        if (result.type === 'brief') {
          expect(result.content.title).toBe('Refactor auth, preserve tokens');
          expect(result.content.avoid_areas).toContain('token signing logic');
          expect(result.content.estimated_complexity).toBe('medium');
        }
      });
    });

    describe('Example C — Ops task (skip questions)', () => {
      it('parses ops brief with suggested_project', () => {
        const rawText = JSON.stringify({
          questions: null,
          brief: {
            title: 'Diagnose IRIS 502 errors',
            objective: 'IRIS returning 502. Identify root cause, fix or escalate.',
            acceptance_criteria: ['Root cause identified', 'IRIS /health returns 200', 'Incident summary written'],
            avoid_areas: [],
            estimated_complexity: 'small',
            suggested_project: 'ops-homelab',
          },
        });

        const result = parseLLMResponse(rawText, 'check IRIS 502');
        expect(result.type).toBe('brief');
        if (result.type === 'brief') {
          expect(result.content.title).toBe('Diagnose IRIS 502 errors');
          expect(result.content.suggested_project).toBe('ops-homelab');
          expect(result.content.estimated_complexity).toBe('small');
        }
      });
    });

    describe('Edge cases', () => {
      it('handles {type, content} format directly', () => {
        const rawText = JSON.stringify({
          type: 'brief',
          content: {
            title: 'Test brief',
            objective: 'Test objective',
            acceptance_criteria: [],
            avoid_areas: [],
          },
        });

        const result = parseLLMResponse(rawText, 'test');
        expect(result.type).toBe('brief');
      });

      it('handles no JSON in output — fallback to raw text', () => {
        const result = parseLLMResponse('No JSON here at all', 'original input');
        expect(result.type).toBe('brief');
        if (result.type === 'brief') {
          expect(result.content.title).toBe('original input');
          expect(result.content.objective).toBe('No JSON here at all');
          expect(result.content.estimated_complexity).toBe('small');
        }
      });

      it('handles malformed JSON — fallback', () => {
        const result = parseLLMResponse('{ broken json }}}', 'my task');
        expect(result.type).toBe('brief');
        if (result.type === 'brief') {
          expect(result.content.title).toBe('my task');
        }
      });

      it('handles JSON embedded in prose', () => {
        const rawText = 'Here is my analysis:\n\n' + JSON.stringify({
          questions: null,
          brief: {
            title: 'Embedded brief',
            objective: 'Found in prose',
            acceptance_criteria: ['works'],
            avoid_areas: [],
            estimated_complexity: 'trivial',
            suggested_project: null,
          },
        }) + '\n\nHope that helps!';

        const result = parseLLMResponse(rawText, 'test');
        expect(result.type).toBe('brief');
        if (result.type === 'brief') {
          expect(result.content.title).toBe('Embedded brief');
        }
      });

      it('handles multiple questions (max 3)', () => {
        const rawText = JSON.stringify({
          questions: ['Q1?', 'Q2?', 'Q3?'],
          brief: null,
        });

        const result = parseLLMResponse(rawText, 'test');
        expect(result.type).toBe('questions');
        if (result.type === 'questions') {
          expect(result.content).toHaveLength(3);
        }
      });

      it('truncates long titles in fallback', () => {
        const longInput = 'A'.repeat(200);
        const result = parseLLMResponse('no json', longInput);
        if (result.type === 'brief') {
          expect(result.content.title.length).toBeLessThanOrEqual(50);
        }
      });
    });
  });
});
