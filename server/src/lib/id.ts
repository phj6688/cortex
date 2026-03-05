/**
 * Prefixed nanoid generators for all entity types.
 * @module lib/id
 */

import { nanoid } from 'nanoid';

/** @returns A new task ID (tsk_xxxxxxxx) */
export function taskId(): string {
  return `tsk_${nanoid(8)}`;
}

/** @returns A new project ID (prj_xxxxxxxx) */
export function projectId(): string {
  return `prj_${nanoid(8)}`;
}

/** @returns A new event ID (evt_xxxxxxxx) */
export function eventId(): string {
  return `evt_${nanoid(8)}`;
}

/** @returns A new comment ID (cmt_xxxxxxxx) */
export function commentId(): string {
  return `cmt_${nanoid(8)}`;
}
