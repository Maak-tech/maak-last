/**
 * Main oRPC router
 * Start here - add routes as needed
 */

import { ingestVital } from '../src/api/vitals';

export const appRouter = {
  vitals: {
    ingest: ingestVital,
  },
};

export type AppRouter = typeof appRouter;
