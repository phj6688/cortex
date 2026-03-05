'use client';

/**
 * Illustrated empty states with CTA.
 * @module components/shared/empty-state
 */

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon = '[ ]', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div
        className="mb-3 text-3xl"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <p className="mt-1 max-w-[240px] text-xs" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 min-h-[44px] rounded-lg px-4 py-2 text-xs font-medium"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
