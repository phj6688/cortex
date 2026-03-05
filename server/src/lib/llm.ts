/**
 * Anthropic SDK wrapper for streaming.
 * @module lib/llm
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';

let client: Anthropic | null = null;

/**
 * Get or create the Anthropic client singleton.
 * @returns Anthropic client
 * @throws If ANTHROPIC_API_KEY is not configured
 */
export function getClient(): Anthropic {
  if (!client) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      ...(env.ANTHROPIC_BASE_URL && { baseURL: env.ANTHROPIC_BASE_URL }),
    });
  }
  return client;
}

/**
 * Create a streaming message request.
 * @param system - System prompt
 * @param userMessage - User message content
 * @param model - Model to use
 * @returns Streaming message response
 */
export function streamMessage(
  system: string,
  userMessage: string,
  model = 'claude-sonnet-4-20250514',
) {
  return getClient().messages.stream({
    model,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });
}
