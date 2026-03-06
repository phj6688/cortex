/**
 * Centralized toast helper — consistent styling via sonner.
 * @module lib/notify
 */

import { toast } from 'sonner';

/**
 * Green accent, auto-dismiss 3s.
 * @param message - The success message to display
 */
export function success(message: string): void {
  toast.success(message, { duration: 3000 });
}

/**
 * Red accent, persists until dismissed.
 * @param message - The error message to display
 */
export function error(message: string): void {
  toast.error(message, { duration: Infinity });
}

/**
 * Gray, auto-dismiss 5s.
 * @param message - The info message to display
 */
export function info(message: string): void {
  toast(message, { duration: 5000 });
}

/**
 * Amber, auto-dismiss 5s.
 * @param message - The warning message to display
 */
export function warn(message: string): void {
  toast.warning(message, { duration: 5000 });
}
