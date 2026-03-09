import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosHeaders } from 'axios';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockSetBackendDown = vi.fn();
vi.mock('@/store/connectionStore', () => ({
  useConnectionStore: {
    getState: () => ({
      setBackendDown: mockSetBackendDown,
    }),
  },
}));

const mockDeselectProfile = vi.fn();
vi.mock('@/store/profileStore', () => ({
  useProfileStore: {
    getState: vi.fn(() => ({
      deselectProfile: mockDeselectProfile,
    })),
  },
}));

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is created with baseURL /api/v1', async () => {
    const { apiClient } = await import('@/lib/api');
    expect(apiClient.defaults.baseURL).toBe('/api/v1');
  });

  it('has withCredentials enabled', async () => {
    const { apiClient } = await import('@/lib/api');
    expect(apiClient.defaults.withCredentials).toBe(true);
  });

  it('has Content-Type application/json header', async () => {
    const { apiClient } = await import('@/lib/api');
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('has a 10 second timeout', async () => {
    const { apiClient } = await import('@/lib/api');
    expect(apiClient.defaults.timeout).toBe(10000);
  });

  describe('response interceptor', () => {
    it('passes successful responses through', async () => {
      const { apiClient } = await import('@/lib/api');
      const interceptors = apiClient.interceptors.response as any;
      const handlers = interceptors.handlers;
      const successHandler = handlers.find((h: any) => h?.fulfilled);

      const mockResponse = { data: { test: true }, status: 200 };
      const result = await successHandler.fulfilled(mockResponse);
      expect(result).toEqual(mockResponse);
    });

    it('sets backend down on 502 response and rejects', async () => {
      mockSetBackendDown.mockClear();
      vi.resetModules();

      vi.doMock('@/store/connectionStore', () => ({
        useConnectionStore: {
          getState: () => ({
            setBackendDown: mockSetBackendDown,
          }),
        },
      }));

      const { apiClient: freshClient } = await import('@/lib/api');
      const interceptors = freshClient.interceptors.response as any;
      const handlers = interceptors.handlers;
      const errorHandler = handlers.find((h: any) => h?.rejected);

      const mockError = {
        response: {
          status: 502,
          data: { error: 'Backend unavailable' },
        },
        config: { headers: new AxiosHeaders() },
      };

      await expect(errorHandler.rejected(mockError)).rejects.toEqual(mockError);
      expect(mockSetBackendDown).toHaveBeenCalled();
    });

    it('sets backend down on network error (no response) and rejects', async () => {
      mockSetBackendDown.mockClear();
      vi.resetModules();

      vi.doMock('@/store/connectionStore', () => ({
        useConnectionStore: {
          getState: () => ({
            setBackendDown: mockSetBackendDown,
          }),
        },
      }));

      const { apiClient: freshClient } = await import('@/lib/api');
      const interceptors = freshClient.interceptors.response as any;
      const handlers = interceptors.handlers;
      const errorHandler = handlers.find((h: any) => h?.rejected);

      const mockError = {
        message: 'Network Error',
        config: { headers: new AxiosHeaders() },
      };

      await expect(errorHandler.rejected(mockError)).rejects.toEqual(mockError);
      expect(mockSetBackendDown).toHaveBeenCalled();
    });

    it('rejects non-401/502 errors without interception', async () => {
      const { apiClient } = await import('@/lib/api');
      const interceptors = apiClient.interceptors.response as any;
      const handlers = interceptors.handlers;
      const errorHandler = handlers.find((h: any) => h?.rejected);

      const mockError = {
        response: {
          status: 500,
          data: { message: 'Server error' },
        },
        config: { headers: new AxiosHeaders() },
      };

      await expect(errorHandler.rejected(mockError)).rejects.toEqual(mockError);
    });
  });
});
