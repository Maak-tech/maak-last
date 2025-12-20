/**
 * oRPC context - contains request metadata like auth
 */

export type AppContext = {
  userId?: string;
  auth?: {
    uid: string;
    email?: string;
  };
};

export function createContext(): AppContext {
  // TODO: Extract auth from request headers/token
  // For now, return empty context
  return {};
}
