/**
 * tRPC client setup — port 3481.
 * @module lib/trpc
 */

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../server/src/routes/trpc.js';

export const trpc = createTRPCReact<AppRouter>();

export type { AppRouter };
