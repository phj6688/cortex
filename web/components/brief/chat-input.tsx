'use client';

/**
 * Auto-resize textarea with submit on Enter.
 * @module components/brief/chat-input
 */

import { useRef, useCallback, forwardRef, useImperativeHandle, type KeyboardEvent, type ChangeEvent } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onAbort?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
}

export const ChatInput = forwardRef<HTMLTextAreaElement | null, ChatInputProps>(
  function ChatInput(
    { value, onChange, onSubmit, onAbort, disabled = false, streaming = false, placeholder = 'Describe what you need done...' },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => textareaRef.current!, []);

    const autoResize = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, []);

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      autoResize();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && value.trim()) {
          onSubmit();
        }
      }
    };

    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || streaming}
          placeholder={placeholder}
          rows={1}
          className="min-h-[44px] w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition-colors"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text-brief)',
            fontFamily: 'var(--font-sans)',
            transitionDuration: 'var(--timing-fast)',
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          {streaming && onAbort ? (
            <button
              type="button"
              onClick={onAbort}
              className="min-h-[44px] rounded px-3 py-1 text-xs font-medium text-white"
              style={{ background: 'var(--danger)' }}
            >
              Stop
            </button>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Enter to send, Shift+Enter for newline
            </span>
          )}
          {!streaming && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={disabled || !value.trim()}
              className="min-h-[44px] rounded px-3 py-1 text-xs font-medium transition-opacity disabled:opacity-40"
              style={{
                background: 'var(--accent)',
                color: '#000',
              }}
            >
              Send
            </button>
          )}
        </div>
      </div>
    );
  },
);
