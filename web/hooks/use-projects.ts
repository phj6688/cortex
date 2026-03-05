'use client';

/**
 * TanStack Query hook for projects.
 * @module hooks/use-projects
 */

import { trpc } from '../lib/trpc';

export function useProjects() {
  return trpc.project.list.useQuery();
}

export function useProject(id: string | null) {
  return trpc.project.get.useQuery(
    { id: id! },
    { enabled: !!id },
  );
}
