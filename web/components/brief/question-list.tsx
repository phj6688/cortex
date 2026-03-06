'use client';

/**
 * Container for clarifying question cards with submit/skip actions.
 * @module components/brief/question-list
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { QuestionCard } from './question-card';

interface QuestionListProps {
  questions: string[];
  onSubmit: (answers: string[]) => void;
  onSkip: () => void;
}

export function QuestionList({ questions, onSubmit, onSkip }: QuestionListProps) {
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));

  const allAnswered = answers.every((a) => a.trim().length > 0);

  const handleChange = (index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  return (
    <div className="mt-3 space-y-3">
      {questions.map((q, i) => (
        <motion.div
          key={q}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.25 }}
        >
          <QuestionCard
            index={i}
            question={q}
            answer={answers[i] ?? ''}
            onChange={(v) => handleChange(i, v)}
          />
        </motion.div>
      ))}

      <div className="flex flex-col items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => onSubmit(answers)}
          disabled={!allAnswered}
          className="min-h-[44px] w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-40"
          style={{
            background: allAnswered ? 'var(--accent)' : 'var(--border)',
            color: allAnswered ? '#000' : 'var(--text-secondary)',
          }}
        >
          Submit Answers
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="px-2 py-1 text-xs transition-colors hover:underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          Skip questions — write brief manually
        </button>
      </div>
    </div>
  );
}
