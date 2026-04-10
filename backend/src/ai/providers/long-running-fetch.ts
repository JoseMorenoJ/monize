import { Agent } from "undici";

/**
 * Shared dispatcher used for long-running AI provider requests.
 *
 * Node's built-in fetch (undici under the hood) defaults `bodyTimeout` and
 * `headersTimeout` to 5 minutes. That's far too aggressive for CPU-only
 * inference on slow hardware (e.g. an Intel N100), where the gap between
 * the request and the first generated token can easily exceed 5 minutes
 * for a cold model with a long financial-context prompt. When the timer
 * fires, undici aborts the stream and the caller sees a generic
 * "fetch failed" error.
 *
 * Setting both timeouts to 0 disables them entirely. The provider code
 * still caps the total request time with its own AbortController, so a
 * runaway request can't hang forever.
 */
export const longRunningAgent = new Agent({
  bodyTimeout: 0,
  headersTimeout: 0,
});

/**
 * fetch wrapper that injects {@link longRunningAgent} as the dispatcher.
 * Use this when constructing AI SDK clients that take a `fetch` option,
 * so the SDK's internal HTTP calls inherit the disabled timeouts.
 */
export const longRunningFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    dispatcher: longRunningAgent,
  } as RequestInit);
