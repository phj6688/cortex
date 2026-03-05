'use client';

/**
 * Skeleton screens — zero spinners policy.
 * @module components/layout/skeleton
 */

function Bone({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: 'var(--border)' }}
    />
  );
}

export function BriefPanelSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Bone className="h-6 w-16" />
      <Bone className="h-10 w-full" />
      <Bone className="h-32 w-full rounded-lg" />
      <Bone className="h-8 w-24" />
      <Bone className="h-10 w-full rounded-lg" />
    </div>
  );
}

export function TaskListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={`skel-${i}`}
          className="rounded-lg border p-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <Bone className="h-4 w-20" />
          <Bone className="mt-2 h-4 w-3/4" />
          <div className="mt-2 flex justify-between">
            <Bone className="h-3 w-12" />
            <Bone className="h-3 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaskDetailSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Bone className="h-5 w-28" />
      <Bone className="h-6 w-3/4" />
      <Bone className="h-3 w-32" />
      <Bone className="mt-4 h-24 w-full rounded-lg" />
      <Bone className="h-4 w-20" />
      <div className="space-y-2">
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-2/3" />
      </div>
    </div>
  );
}
