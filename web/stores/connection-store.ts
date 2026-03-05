/**
 * Zustand store for SSE connection status.
 * @module stores/connection-store
 */

import { create } from 'zustand';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionStore {
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: 'disconnected',
  setStatus: (status) => set({ status }),
}));
