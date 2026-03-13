import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@/test/render';
import { BackendDownBanner } from './BackendDownBanner';
import { useConnectionStore } from '@/store/connectionStore';

describe('BackendDownBanner', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    useConnectionStore.setState({ isBackendDown: false, downSince: null });
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, protocol: 'http:', reload: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('renders nothing when backend is up', () => {
    const { container } = render(<BackendDownBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders banner when backend is down', async () => {
    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    await act(async () => {
      render(<BackendDownBanner />);
    });
    expect(screen.getByText('Connection Lost')).toBeInTheDocument();
  });

  it('displays retry message when down', async () => {
    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    await act(async () => {
      render(<BackendDownBanner />);
    });
    expect(
      screen.getByText(/Unable to reach the server\. Retrying automatically/),
    ).toBeInTheDocument();
  });

  it('renders Connection Lost label in bold', async () => {
    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    await act(async () => {
      render(<BackendDownBanner />);
    });
    const label = screen.getByText('Connection Lost');
    expect(label.tagName).toBe('SPAN');
    expect(label.className).toContain('font-semibold');
  });

  it('uses red color scheme', async () => {
    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(<BackendDownBanner />));
    });
    const banner = container!.firstChild as HTMLElement;
    expect(banner.className).toContain('bg-red-50');
    expect(banner.className).toContain('text-red-800');
  });

  it('polls health endpoint every 5 seconds when down', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    render(<BackendDownBanner />);

    // No fetch yet (first poll is after interval)
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance 5 seconds -- first poll
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/health/live', { cache: 'no-store' });

    // Advance another 5 seconds -- second poll
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not poll when backend is up', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<BackendDownBanner />);

    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reloads the page when health check succeeds', async () => {
    const reloadMock = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    render(<BackendDownBanner />);

    await vi.advanceTimersByTimeAsync(5000);
    expect(reloadMock).toHaveBeenCalled();
  });

  it('continues polling when health check returns non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    render(<BackendDownBanner />);

    await vi.advanceTimersByTimeAsync(5000);
    expect(reloadMock).not.toHaveBeenCalled();

    // Continues polling
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('cleans up interval on unmount', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    const { unmount } = render(<BackendDownBanner />);

    unmount();

    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // HTTPS mismatch tests
  it('shows Connection Blocked when httpsHeadersActive and protocol is http', async () => {
    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    await act(async () => {
      render(<BackendDownBanner httpsHeadersActive={true} />);
    });
    expect(screen.getByText('Connection Blocked')).toBeInTheDocument();
    expect(screen.queryByText('Connection Lost')).not.toBeInTheDocument();
  });

  it('mentions DISABLE_HTTPS_HEADERS in HTTPS mismatch message', async () => {
    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    await act(async () => {
      render(<BackendDownBanner httpsHeadersActive={true} />);
    });
    expect(screen.getByText('DISABLE_HTTPS_HEADERS=true')).toBeInTheDocument();
  });

  it('shows Connection Lost when httpsHeadersActive is false', async () => {
    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    await act(async () => {
      render(<BackendDownBanner httpsHeadersActive={false} />);
    });
    expect(screen.getByText('Connection Lost')).toBeInTheDocument();
    expect(screen.queryByText('Connection Blocked')).not.toBeInTheDocument();
  });

  it('shows Connection Lost when protocol is https even if httpsHeadersActive', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, protocol: 'https:', reload: vi.fn() },
      writable: true,
    });
    useConnectionStore.setState({ isBackendDown: true, downSince: Date.now() });
    await act(async () => {
      render(<BackendDownBanner httpsHeadersActive={true} />);
    });
    expect(screen.getByText('Connection Lost')).toBeInTheDocument();
    expect(screen.queryByText('Connection Blocked')).not.toBeInTheDocument();
  });
});
