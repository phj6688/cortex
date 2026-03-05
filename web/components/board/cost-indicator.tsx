'use client';

/**
 * Cost display — $X.XX formatted, updates via SSE invalidation.
 * @module components/board/cost-indicator
 */

import { formatCost } from '../../lib/format';

interface CostIndicatorProps {
  costUsd: number;
}

export function CostIndicator({ costUsd }: CostIndicatorProps) {
  if (costUsd === 0) return null;

  return (
    <span
      className="text-xs tabular-nums"
      style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
    >
      {formatCost(costUsd)}
    </span>
  );
}
