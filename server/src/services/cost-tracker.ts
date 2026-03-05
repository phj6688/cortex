/**
 * Token usage cost calculation.
 * @module services/cost-tracker
 */

import { updateTask, getTask } from '../db/queries/tasks.js';
import { addProjectCost } from '../db/queries/projects.js';
import { createEvent } from '../db/queries/events.js';
import { eventId } from '../lib/id.js';
import { publishCostUpdate } from './event-bus.js';

/** Per-model pricing (USD per token) */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5':  { input: 3.0 / 1_000_000,  output: 15.0 / 1_000_000 },
  'claude-haiku-3-5':   { input: 0.8 / 1_000_000,  output: 4.0 / 1_000_000 },
  'claude-opus-4':      { input: 15.0 / 1_000_000,  output: 75.0 / 1_000_000 },
};

export interface CostUpdate {
  task_id: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
}

/**
 * Calculate cost from token counts and model.
 * @param update - Token usage data
 * @returns Cost in USD
 */
export function calculateCost(update: CostUpdate): number {
  const rates = PRICING[update.model] ?? PRICING['claude-sonnet-4-5']!;
  return (update.input_tokens * rates.input) + (update.output_tokens * rates.output);
}

/**
 * Record a cost update for a task.
 * @param update - Cost update data
 * @returns void
 */
export function recordCost(update: CostUpdate): void {
  const cost = calculateCost(update);
  const task = getTask(update.task_id);
  if (!task) return;

  updateTask(update.task_id, {
    cost_usd: task.cost_usd + cost,
    token_input: task.token_input + update.input_tokens,
    token_output: task.token_output + update.output_tokens,
  });

  if (task.project_id) {
    addProjectCost(task.project_id, cost);
  }

  createEvent({
    id: eventId(),
    task_id: update.task_id,
    event_type: 'cost_update',
    payload: JSON.stringify({ cost, model: update.model, input_tokens: update.input_tokens, output_tokens: update.output_tokens }),
  });

  publishCostUpdate(update.task_id, task.cost_usd + cost);
}
