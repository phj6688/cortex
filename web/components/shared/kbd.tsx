'use client';

/**
 * Keyboard shortcut hint component.
 * @module components/shared/kbd
 */

interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export function Kbd({ children, className = '' }: KbdProps) {
  return (
    <kbd
      className={`inline-flex min-h-[22px] min-w-[22px] items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${className}`}
      style={{
        borderColor: 'var(--border)',
        color: 'var(--text-secondary)',
        background: 'var(--bg-elevated)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {children}
    </kbd>
  );
}
