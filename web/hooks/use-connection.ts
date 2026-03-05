/**
 * Connection state hook — reads from Zustand store.
 * @module hooks/use-connection
 */

import { useConnectionStore, type ConnectionStatus } from '../stores/connection-store';

export function useConnection(): ConnectionStatus {
  return useConnectionStore((s) => s.status);
}
