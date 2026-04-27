import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@/test/render';
import { AxiosError, AxiosHeaders } from 'axios';
import { PwaLifecycleHandler } from './PwaLifecycleHandler';

const mockGetProfile = vi.fn();
const mockLogout = vi.fn();
let mockIsAuthenticated = true;

vi.mock('@/lib/auth', () => ({
  authApi: {
    getProfile: () => mockGetProfile(),
  },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      isAuthenticated: mockIsAuthenticated,
      logout: mockLogout,
    }),
  },
}));

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

function firePageShow(persisted: boolean) {
  const event = new Event('pageshow') as Event & { persisted: boolean };
  Object.defineProperty(event, 'persisted', { value: persisted });
  window.dispatchEvent(event);
}

describe('PwaLifecycleHandler', () => {
  let replaceSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockIsAuthenticated = true;
    mockGetProfile.mockResolvedValue({ id: 'u1' });

    originalLocation = window.location;
    replaceSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, replace: replaceSpy, pathname: '/dashboard' },
    });

    // Force standalone PWA detection
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: '(display-mode: standalone)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('renders nothing', () => {
    const { container } = render(<PwaLifecycleHandler />);
    expect(container.innerHTML).toBe('');
  });

  it('does not re-validate when resume is fast (< stale threshold)', async () => {
    render(<PwaLifecycleHandler />);

    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    setVisibility('visible');

    // Allow the async onResume handler to run
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it('re-validates auth when resume happens after stale threshold', async () => {
    render(<PwaLifecycleHandler />);

    setVisibility('hidden');
    vi.advanceTimersByTime(6 * 60 * 1000);
    setVisibility('visible');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetProfile).toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('forces hard navigation to /login on 401 during stale resume in standalone PWA', async () => {
    const error = new AxiosError(
      'Unauthorized',
      '401',
      undefined,
      undefined,
      {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }
    );
    mockGetProfile.mockRejectedValue(error);

    render(<PwaLifecycleHandler />);

    setVisibility('hidden');
    vi.advanceTimersByTime(6 * 60 * 1000);
    setVisibility('visible');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLogout).toHaveBeenCalled();
    expect(replaceSpy).toHaveBeenCalledWith('/login');
  });

  it('does not navigate when backend is unreachable (502 / no response)', async () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK');
    mockGetProfile.mockRejectedValue(error);

    render(<PwaLifecycleHandler />);

    setVisibility('hidden');
    vi.advanceTimersByTime(6 * 60 * 1000);
    setVisibility('visible');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('always re-validates on BFCache restore (pageshow with persisted=true)', async () => {
    render(<PwaLifecycleHandler />);

    firePageShow(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetProfile).toHaveBeenCalled();
  });

  it('ignores pageshow when persisted=false (initial load)', async () => {
    render(<PwaLifecycleHandler />);

    firePageShow(false);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it('does not re-validate when not authenticated', async () => {
    mockIsAuthenticated = false;
    render(<PwaLifecycleHandler />);

    setVisibility('hidden');
    vi.advanceTimersByTime(6 * 60 * 1000);
    setVisibility('visible');

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetProfile).not.toHaveBeenCalled();
  });
});
