'use client';

/**
 * Individual question card with auto-resize answer input.
 * @module components/brief/question-card
 */

import { useRef, useCallback, useState, type ChangeEvent } from 'react';
import * as notify from '../../lib/notify';

interface QuestionCardProps {
  index: number;
  question: string;
  answer: string;
  onChange: (value: string) => void;
}

export function QuestionCard({ index, question, answer, onChange }: QuestionCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 20;
    const maxHeight = lineHeight * 6;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    autoResize();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(question);
      setCopied(true);
      notify.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error('Failed to copy');
    }
  };

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: 'var(--border)',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold"
            style={{ background: 'var(--accent-glow)', color: 'var(--accent-dim)' }}
          >
            Q{index + 1}
          </span>
          <p className="text-sm font-medium" style={{ color: 'var(--text-brief)' }}>
            {question}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded p-1 text-xs transition-colors hover:bg-black/5"
          style={{ color: 'var(--text-secondary)' }}
          title="Copy question"
        >
          {copied ? '\u2713' : '\u2398'}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={answer}
        onChange={handleChange}
        placeholder="Your answer..."
        rows={1}
        className="w-full resize-none rounded border bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-[var(--border-focus)]"
        style={{
          borderColor: 'var(--border)',
          color: 'var(--text-brief)',
          fontFamily: 'var(--font-sans)',
          minHeight: '36px',
        }}
      />
    </div>
  );
}
