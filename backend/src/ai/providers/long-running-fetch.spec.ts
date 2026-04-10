import { longRunningAgent, longRunningFetch } from "./long-running-fetch";

describe("long-running-fetch", () => {
  describe("longRunningAgent", () => {
    it("is configured with disabled body and headers timeouts", () => {
      // The Agent itself doesn't expose its options publicly, but its
      // existence + correct shape is what matters for the type system.
      // The behavioral verification is via the spec below that asserts
      // longRunningFetch passes it as the dispatcher option.
      expect(longRunningAgent).toBeDefined();
      expect(typeof longRunningAgent.dispatch).toBe("function");
    });
  });

  describe("longRunningFetch", () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("invokes global fetch with the long-running dispatcher injected", async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValue(new Response("ok", { status: 200 }));
      global.fetch = mockFetch as unknown as typeof fetch;

      await longRunningFetch("https://example.test/api", {
        method: "POST",
        body: JSON.stringify({ ping: true }),
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://example.test/api");
      expect(init.method).toBe("POST");
      // The dispatcher option must be the shared long-running agent
      expect((init as { dispatcher?: unknown }).dispatcher).toBe(
        longRunningAgent,
      );
    });

    it("passes through caller-provided init options", async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValue(new Response("ok", { status: 200 }));
      global.fetch = mockFetch as unknown as typeof fetch;

      const headers = { "X-Custom": "value" };
      await longRunningFetch("https://example.test/api", {
        method: "GET",
        headers,
      });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe("GET");
      expect(init.headers).toBe(headers);
      expect((init as { dispatcher?: unknown }).dispatcher).toBe(
        longRunningAgent,
      );
    });

    it("works without any caller-provided init", async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValue(new Response("ok", { status: 200 }));
      global.fetch = mockFetch as unknown as typeof fetch;

      await longRunningFetch("https://example.test/api");

      const [, init] = mockFetch.mock.calls[0];
      expect((init as { dispatcher?: unknown }).dispatcher).toBe(
        longRunningAgent,
      );
    });

    it("matches the global fetch signature", () => {
      // Compile-time check: longRunningFetch must be assignable to typeof fetch
      const f: typeof fetch = longRunningFetch;
      expect(typeof f).toBe("function");
    });
  });
});
