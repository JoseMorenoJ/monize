import { renderHook } from '@testing-library/react';
import { useOnUndoRedo } from './useOnUndoRedo';

describe('useOnUndoRedo', () => {
  it('should call callback when undoredo event fires', () => {
    const callback = vi.fn();
    renderHook(() => useOnUndoRedo(callback));

    window.dispatchEvent(new CustomEvent('undoredo'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should clean up listener on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useOnUndoRedo(callback));

    unmount();
    window.dispatchEvent(new CustomEvent('undoredo'));
    expect(callback).not.toHaveBeenCalled();
  });

  it('should update listener when callback changes', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useOnUndoRedo(cb),
      { initialProps: { cb: callback1 } },
    );

    rerender({ cb: callback2 });
    window.dispatchEvent(new CustomEvent('undoredo'));

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });
});
