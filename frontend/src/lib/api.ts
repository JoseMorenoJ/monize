import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { createLogger } from '@/lib/logger';

const logger = createLogger('API');

// Use relative URL - Next.js rewrites handle routing to backend
export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true,
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    logger.debug(`${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
let isRedirecting = false;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Handle 502 (backend unavailable) or network errors (no response at all)
    if (error.response?.status === 502 || !error.response) {
      const { useConnectionStore } = await import('@/store/connectionStore');
      useConnectionStore.getState().setBackendDown();
      return Promise.reject(error);
    }

    // Handle 401 — session expired or invalid, redirect to profile picker
    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true;
      logger.warn('Unauthorized — redirecting to profile picker');
      const { useProfileStore } = await import('@/store/profileStore');
      useProfileStore.getState().deselectProfile();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/profiles')) {
        window.location.href = '/profiles';
      }
      isRedirecting = false;
    }

    return Promise.reject(error);
  }
);

export default apiClient;
