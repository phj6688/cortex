'use client';

/**
 * Left 40% — chat + brief refinement + sign-off.
 * Failure cases #4 (LLM timeout) and #5 (no project at sign-off) handled here.
 * @module components/canvas/brief-panel
 */

import { useState, useCallback, useRef, useEffect, type MutableRefObject } from 'react';
import * as notify from '../../lib/notify';
import { ChatInput } from '../brief/chat-input';
import { RefinementStream } from '../brief/refinement-stream';
import { BriefCard } from '../brief/brief-card';
import { BriefEditor } from '../brief/brief-editor';
import { ProjectSelector } from '../brief/project-selector';
import { SignOffButton } from '../brief/sign-off-button';
import { QuestionList } from '../brief/question-list';
import { EmptyState } from '../shared/empty-state';
import { BriefPanelSkeleton } from '../layout/skeleton';
import { streamBriefRefinement, type BriefContent, type BriefCompletePayload } from '../../lib/api';
import { trpc } from '../../lib/trpc';

type Phase = 'input' | 'streaming' | 'questions' | 'brief' | 'editing' | 'dispatching' | 'signed-off';

interface BriefPanelProps {
  chatInputRef?: MutableRefObject<HTMLTextAreaElement | null>;
}

export function BriefPanel({ chatInputRef }: BriefPanelProps) {
  const [phase, setPhase] = useState<Phase>('input');
  const [input, setInput] = useState('');
  const [tokens, setTokens] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [brief, setBrief] = useState<BriefContent | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [originalInput, setOriginalInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [noProjectWarning, setNoProjectWarning] = useState(false);
  const [dispatchedTaskId, setDispatchedTaskId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const localInputRef = useRef<HTMLTextAreaElement | null>(null);

  const createTask = trpc.task.create.useMutation();
  const updateState = trpc.task.updateState.useMutation();
  const approveTask = trpc.task.approve.useMutation();
  const utils = trpc.useUtils();

  // Merge external ref
  const setInputRef = useCallback((el: HTMLTextAreaElement | null) => {
    localInputRef.current = el;
    if (chatInputRef) chatInputRef.current = el;
  }, [chatInputRef]);

  const startStream = useCallback(async (text: string, prevAnswers?: string[]) => {
    setPhase('streaming');
    setTokens('');
    setWarning(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const event of streamBriefRefinement(text, controller.signal, prevAnswers)) {
        switch (event.type) {
          case 'token':
            setTokens(prev => prev + event.content);
            break;
          case 'warning':
            // Failure case #4: 10s warning
            setWarning(event.content);
            break;
          case 'fallback':
            // Failure case #4: 20s → manual editor
            setPhase('editing');
            return;
          case 'complete': {
            const payload = event.content as BriefCompletePayload;
            if (payload.type === 'questions') {
              setQuestions(payload.content);
              setPhase('questions');
            } else {
              setBrief(payload.content);
              if (payload.content.suggested_project) {
                setProjectId(payload.content.suggested_project);
              }
              setPhase('brief');
            }
            break;
          }
          case 'error':
            setError(event.content);
            setPhase('input');
            break;
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
        setPhase('input');
      }
    } finally {
      abortRef.current = null;
    }
  }, []);

  const handleSubmit = () => {
    if (!input.trim()) return;
    setOriginalInput(input.trim());
    startStream(input.trim());
  };

  const handleAbort = () => {
    abortRef.current?.abort();
    setPhase('input');
  };

  const handleAnswersSubmit = (submittedAnswers: string[]) => {
    setAnswers(submittedAnswers);
    const formatted = questions
      .map((q, i) => `Q: ${q}\nA: ${submittedAnswers[i]}`)
      .join('\n\n');
    startStream(`${originalInput}\n\n${formatted}`, submittedAnswers);
  };

  const handleSkipQuestions = () => setPhase('editing');
  const handleEditorSave = (edited: BriefContent) => { setBrief(edited); setPhase('brief'); };

  const handleSignOff = async () => {
    if (!brief) return;

    // Failure case #5: no project at sign-off
    if (!projectId) {
      setNoProjectWarning(true);
      return;
    }
    setNoProjectWarning(false);

    try {
      const task = await createTask.mutateAsync({
        title: brief.title,
        raw_input: originalInput,
        brief: JSON.stringify(brief),
        project_id: projectId,
      });

      await updateState.mutateAsync({
        id: task.id,
        state: 'refined',
      });

      await updateState.mutateAsync({
        id: task.id,
        state: 'pending_approval',
      });

      await approveTask.mutateAsync({ id: task.id });

      setDispatchedTaskId(task.id);
      setPhase('dispatching');
    } catch (err) {
      // Failure case #3: SSE disconnect during sign-off
      notify.error('Sign-off failed — try again');
      setError((err as Error).message);
    }
  };

  const handleReset = () => {
    setPhase('input'); setInput(''); setOriginalInput(''); setTokens('');
    setWarning(null); setQuestions([]); setAnswers([]); setBrief(null);
    setProjectId(null); setError(null); setNoProjectWarning(false);
    setDispatchedTaskId(null);
    abortRef.current?.abort(); abortRef.current = null;
  };

  useEffect(() => {
    if (phase !== 'dispatching' || !dispatchedTaskId) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const task = await utils.task.get.fetch({ id: dispatchedTaskId });
        if (task.state === 'dispatched' || task.state === 'running') {
          notify.success('Task dispatched to agent');
          setPhase('signed-off');
        } else if (task.state === 'failed') {
          notify.error(`Dispatch failed: ${task.failure_reason ?? 'unknown error'}`);
          setPhase('signed-off');
        }
      } catch {
        // Fetch error — keep polling
      }
    }, 1500);

    const timeout = setTimeout(() => {
      if (!cancelled) {
        notify.warn('Dispatch timed out — check task board');
        setPhase('signed-off');
      }
    }, 35_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [phase, dispatchedTaskId, utils]);

  return (
    <div className="flex h-full flex-col p-6">
      <h2
        className="mb-4 text-lg font-semibold"
        style={{ color: 'var(--text-brief)', fontFamily: 'var(--font-mono)' }}
      >
        Brief
      </h2>

      {error && (
        <div
          className="mb-3 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      {phase === 'input' && (
        <>
          <ChatInput
            ref={setInputRef}
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Describe what you need done..."
          />
          {!input && (
            <EmptyState
              icon=">"
              title="Start a brief"
              description="Describe what you need done and AI will refine it into a structured brief."
            />
          )}
        </>
      )}

      {phase === 'streaming' && (
        <>
          {tokens.length === 0 ? (
            <BriefPanelSkeleton />
          ) : (
            <RefinementStream tokens={tokens} isStreaming warning={warning} />
          )}
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            onAbort={handleAbort}
            streaming
            disabled
          />
        </>
      )}

      {phase === 'questions' && (
        <QuestionList
          questions={questions}
          onSubmit={handleAnswersSubmit}
          onSkip={handleSkipQuestions}
        />
      )}

      {phase === 'brief' && brief && (
        <>
          <BriefCard brief={brief} onBriefChange={setBrief} />
          <ProjectSelector value={projectId} onChange={(id) => { setProjectId(id); setNoProjectWarning(false); }} />

          {/* Failure case #5: no project warning */}
          {noProjectWarning && (
            <p className="mt-1 text-xs font-medium" style={{ color: 'var(--warning)' }}>
              Select a project before signing off
            </p>
          )}

          <div className="mt-2">
            <button
              type="button"
              onClick={handleReset}
              className="min-h-[44px] rounded border px-3 py-1 text-xs"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Start Over
            </button>
          </div>
          <SignOffButton
            onSignOff={handleSignOff}
            disabled={!brief}
          />
        </>
      )}

      {phase === 'editing' && (
        <BriefEditor
          initial={brief ?? undefined}
          onSave={handleEditorSave}
          onCancel={() => setPhase(brief ? 'brief' : 'input')}
        />
      )}

      {phase === 'dispatching' && (
        <div className="mt-4 text-center">
          <div
            className="rounded-lg p-4"
            style={{ background: 'var(--accent-glow)' }}
          >
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
            />
            <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--accent-dim)' }}>
              Dispatching to agent...
            </p>
          </div>
        </div>
      )}

      {phase === 'signed-off' && (
        <div className="mt-4 text-center">
          <div
            className="rounded-lg p-4"
            style={{ background: 'var(--accent-glow)', color: 'var(--accent-dim)' }}
          >
            <p className="text-sm font-semibold">Signed off — task approved</p>
            <p className="mt-1 text-xs">Task is dispatching to agent</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="mt-3 min-h-[44px] rounded border px-4 py-1.5 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            New Brief
          </button>
        </div>
      )}
    </div>
  );
}
