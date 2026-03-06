/**
 * Zustand store: UI state — selected task, panel, filters, sort.
 * @module stores/ui-store
 */

import { create } from 'zustand';

export type FilterValue = 'all' | 'active' | 'done' | 'failed' | 'sleeping';
export type SortValue = 'priority' | 'recent' | 'state';
export type MobileTab = 'brief' | 'board';

interface UIStore {
  selectedTaskId: string | null;
  selectTask: (id: string | null) => void;

  detailOpen: boolean;
  setDetailOpen: (open: boolean) => void;

  aoFullscreen: boolean;
  toggleAoFullscreen: () => void;

  filter: FilterValue;
  setFilter: (f: FilterValue) => void;

  sort: SortValue;
  setSort: (s: SortValue) => void;

  mobileTab: MobileTab;
  setMobileTab: (tab: MobileTab) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedTaskId: null,
  selectTask: (id) => set({ selectedTaskId: id, detailOpen: id !== null }),

  detailOpen: false,
  setDetailOpen: (open) => set({ detailOpen: open }),

  aoFullscreen: false,
  toggleAoFullscreen: () => set((s) => ({ aoFullscreen: !s.aoFullscreen })),

  filter: 'all',
  setFilter: (filter) => set({ filter }),

  sort: 'priority',
  setSort: (sort) => set({ sort }),

  mobileTab: 'brief',
  setMobileTab: (mobileTab) => set({ mobileTab }),
}));
