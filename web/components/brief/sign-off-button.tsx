'use client';

/**
 * Sign-off button — transitions to pending_approval (NOT auto-approve).
 * @module components/brief/sign-off-button
 */

import { useState } from 'react';

interface SignOffButtonProps {
  disabled?: boolean;
  onSignOff: () => Promise<void>;
}

export function SignOffButton({ disabled = false, onSignOff }: SignOffButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onSignOff();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className="mt-3 min-h-[44px] w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-40"
      style={{
        background: disabled || loading ? 'var(--border)' : 'var(--accent)',
        color: disabled || loading ? 'var(--text-secondary)' : '#000',
        boxShadow: disabled || loading ? 'none' : 'var(--shadow-glow)',
      }}
    >
      {loading ? 'Signing off...' : 'Sign Off & Queue'}
    </button>
  );
}
