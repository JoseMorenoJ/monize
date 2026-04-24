import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  userId?: string;
  timezone?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getRequestTimezone(): string | undefined {
  return requestContextStorage.getStore()?.timezone;
}
