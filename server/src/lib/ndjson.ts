/**
 * NDJSON response helpers.
 * @module lib/ndjson
 */

import type { ServerResponse } from 'node:http';

/**
 * Write NDJSON headers to a raw HTTP response.
 * @param raw - Node.js ServerResponse
 * @returns void
 */
export function writeNdjsonHeaders(raw: ServerResponse): void {
  raw.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
  });
  raw.flushHeaders();
}

/**
 * Write a single NDJSON line.
 * @param raw - Node.js ServerResponse
 * @param type - Event type
 * @param content - Event content
 * @returns void
 */
export function writeNdjsonLine(raw: ServerResponse, type: string, content: unknown): void {
  raw.write(JSON.stringify({ type, content }) + '\n');
}

/**
 * Write an error line and end the response.
 * @param raw - Node.js ServerResponse
 * @param message - Error message
 * @returns void
 */
export function writeNdjsonError(raw: ServerResponse, message: string): void {
  raw.write(JSON.stringify({ type: 'error', content: message }) + '\n');
  raw.end();
}
