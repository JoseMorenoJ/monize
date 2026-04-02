import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollSpy } from './useScrollSpy';

type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;

let intersectionCallback: IntersectionCallback;
let observedElements: Set<Element>;
const disconnectMock = vi.fn();
const observeMock = vi.fn();
const unobserveMock = vi.fn();

function mockIntersectionObserver() {
  observedElements = new Set();
  const MockIO = vi.fn(function (this: any, callback: IntersectionCallback) {
    intersectionCallback = callback;
    this.observe = observeMock.mockImplementation((el: Element) => {
      observedElements.add(el);
    });
    this.unobserve = unobserveMock.mockImplementation((el: Element) => {
      observedElements.delete(el);
    });
    this.disconnect = disconnectMock.mockImplementation(() => {
      observedElements.clear();
    });
  });
  vi.stubGlobal('IntersectionObserver', MockIO);
  return MockIO;
}

function createMockEntry(id: string, isIntersecting: boolean): IntersectionObserverEntry {
  const el = document.getElementById(id) ?? document.createElement('div');
  return {
    target: el,
    isIntersecting,
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: {} as DOMRectReadOnly,
    rootBounds: null,
    time: Date.now(),
  };
}

describe('useScrollSpy', () => {
  const sectionIds = ['profile', 'preferences', 'security'] as const;

  beforeEach(() => {
    observeMock.mockClear();
    unobserveMock.mockClear();
    disconnectMock.mockClear();
    mockIntersectionObserver();
    // Create DOM elements for each section
    for (const id of sectionIds) {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
    // Reset location hash
    window.history.replaceState(null, '', window.location.pathname);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up DOM elements
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  });

  it('returns the first section ID as default active', () => {
    const { result } = renderHook(() => useScrollSpy(sectionIds));
    const [activeId] = result.current;
    expect(activeId).toBe('profile');
  });

  it('returns a setActive function', () => {
    const { result } = renderHook(() => useScrollSpy(sectionIds));
    const [, setActive] = result.current;
    expect(typeof setActive).toBe('function');
  });

  it('observes all section elements', () => {
    renderHook(() => useScrollSpy(sectionIds));
    expect(observeMock).toHaveBeenCalledTimes(3);
    expect(observedElements.size).toBe(3);
  });

  it('updates active section when intersection changes', () => {
    const { result } = renderHook(() => useScrollSpy(sectionIds));

    act(() => {
      intersectionCallback([createMockEntry('security', true)]);
    });

    expect(result.current[0]).toBe('security');
  });

  it('ignores non-intersecting entries', () => {
    const { result } = renderHook(() => useScrollSpy(sectionIds));

    act(() => {
      intersectionCallback([createMockEntry('security', false)]);
    });

    // Should remain at default
    expect(result.current[0]).toBe('profile');
  });

  it('updates window.location.hash via replaceState when updateHash is true', () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    renderHook(() => useScrollSpy(sectionIds, { updateHash: true }));

    act(() => {
      intersectionCallback([createMockEntry('preferences', true)]);
    });

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '#preferences');
  });

  it('does not update hash when updateHash is false', () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    renderHook(() => useScrollSpy(sectionIds, { updateHash: false }));

    act(() => {
      intersectionCallback([createMockEntry('preferences', true)]);
    });

    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('reads initial active section from location hash', () => {
    window.history.replaceState(null, '', '#security');
    const { result } = renderHook(() => useScrollSpy(sectionIds));
    expect(result.current[0]).toBe('security');
  });

  it('ignores unknown hash values', () => {
    window.history.replaceState(null, '', '#unknown-section');
    const { result } = renderHook(() => useScrollSpy(sectionIds));
    expect(result.current[0]).toBe('profile');
  });

  it('scrolls to hash target element on mount', () => {
    window.history.replaceState(null, '', '#preferences');
    const scrollIntoViewMock = vi.fn();
    const el = document.getElementById('preferences');
    if (el) el.scrollIntoView = scrollIntoViewMock;

    renderHook(() => useScrollSpy(sectionIds));

    expect(document.getElementById('preferences')).toBeTruthy();
  });

  it('disconnects observer on unmount', () => {
    const { unmount } = renderHook(() => useScrollSpy(sectionIds));
    unmount();
    expect(disconnectMock).toHaveBeenCalled();
  });

  it('passes custom rootMargin to IntersectionObserver', () => {
    const customMargin = '-20% 0px -60% 0px';
    renderHook(() => useScrollSpy(sectionIds, { rootMargin: customMargin }));

    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rootMargin: customMargin }),
    );
  });

  it('handles empty section IDs gracefully', () => {
    const { result } = renderHook(() => useScrollSpy([]));
    expect(result.current[0]).toBe('');
    expect(observeMock).not.toHaveBeenCalled();
  });

  it('handles missing DOM elements gracefully', () => {
    // Remove one element
    const el = document.getElementById('preferences');
    if (el) el.remove();

    renderHook(() => useScrollSpy(sectionIds));
    // Should observe the 2 remaining elements without error
    expect(observeMock).toHaveBeenCalledTimes(2);
  });

  it('picks the first intersecting entry when multiple are reported', () => {
    const { result } = renderHook(() => useScrollSpy(sectionIds));

    act(() => {
      intersectionCallback([
        createMockEntry('profile', false),
        createMockEntry('preferences', true),
        createMockEntry('security', true),
      ]);
    });

    // Should pick the first intersecting one
    expect(result.current[0]).toBe('preferences');
  });

  it('re-observes when sectionIds change', () => {
    const { rerender } = renderHook(
      ({ ids }) => useScrollSpy(ids),
      { initialProps: { ids: ['profile', 'preferences'] as readonly string[] } },
    );

    expect(observeMock).toHaveBeenCalledTimes(2);
    disconnectMock.mockClear();
    observeMock.mockClear();

    rerender({ ids: ['profile', 'preferences', 'security'] as readonly string[] });

    expect(disconnectMock).toHaveBeenCalled();
    expect(observeMock).toHaveBeenCalledTimes(3);
  });

  describe('enabled option', () => {
    it('does not observe when enabled is false', () => {
      renderHook(() => useScrollSpy(sectionIds, { enabled: false }));
      expect(observeMock).not.toHaveBeenCalled();
    });

    it('starts observing when enabled transitions from false to true', () => {
      const { rerender } = renderHook(
        ({ enabled }) => useScrollSpy(sectionIds, { enabled }),
        { initialProps: { enabled: false } },
      );

      expect(observeMock).not.toHaveBeenCalled();

      rerender({ enabled: true });

      expect(observeMock).toHaveBeenCalledTimes(3);
    });

    it('disconnects observer when enabled transitions from true to false', () => {
      const { rerender } = renderHook(
        ({ enabled }) => useScrollSpy(sectionIds, { enabled }),
        { initialProps: { enabled: true } },
      );

      expect(observeMock).toHaveBeenCalledTimes(3);
      disconnectMock.mockClear();

      rerender({ enabled: false });

      expect(disconnectMock).toHaveBeenCalled();
    });
  });

  describe('setActive', () => {
    it('imperatively sets the active section', () => {
      const { result } = renderHook(() => useScrollSpy(sectionIds));
      expect(result.current[0]).toBe('profile');

      act(() => {
        result.current[1]('security');
      });

      expect(result.current[0]).toBe('security');
    });

    it('updates the hash when called with updateHash true', () => {
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
      const { result } = renderHook(() => useScrollSpy(sectionIds, { updateHash: true }));

      act(() => {
        result.current[1]('preferences');
      });

      expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '#preferences');
    });

    it('does not update the hash when called with updateHash false', () => {
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
      const { result } = renderHook(() => useScrollSpy(sectionIds, { updateHash: false }));

      act(() => {
        result.current[1]('preferences');
      });

      expect(replaceStateSpy).not.toHaveBeenCalled();
    });
  });
});
