/**
 * Zod schema for refined briefs.
 * @module domain/brief-schema
 */

import { z } from 'zod';

/** Schema for a structured brief produced by the LLM */
export const briefSchema = z.object({
  title: z.string().min(1).max(80),
  objective: z.string().min(1),
  acceptance_criteria: z.array(z.string()).default([]),
  avoid_areas: z.array(z.string()).default([]),
  estimated_complexity: z.enum(['trivial', 'small', 'medium', 'large']).optional(),
  suggested_project: z.string().nullable().optional(),
});

export type Brief = z.infer<typeof briefSchema>;

/** Schema for the LLM response (either questions or brief) */
export const llmResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('questions'),
    content: z.array(z.string()).min(1).max(3),
  }),
  z.object({
    type: z.literal('brief'),
    content: briefSchema,
  }),
]);

export type LLMResponse = z.infer<typeof llmResponseSchema>;

/** Schema for the refine request body */
export const refineRequestSchema = z.object({
  input: z.string().min(1).max(10000),
  context: z.string().optional(),
  project_id: z.string().optional(),
  answers: z.array(z.string()).optional(),
});

export type RefineRequest = z.infer<typeof refineRequestSchema>;
