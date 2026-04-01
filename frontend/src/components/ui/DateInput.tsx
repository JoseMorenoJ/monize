import { forwardRef, InputHTMLAttributes, KeyboardEvent, useCallback } from 'react';
import { Input } from './Input';
import { getLocalDateString } from '@/lib/utils';

interface DateInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  onDateChange?: (date: string) => void;
}

function parseOrToday(value: string): Date {
  if (value) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

function DateShortcutTooltip() {
  return (
    <span className="relative hidden sm:inline-flex items-center ml-1 group">
      <svg
        className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs font-normal text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10 pointer-events-none">
        <span className="block font-medium mb-1">Keyboard shortcuts</span>
        <span className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <kbd className="font-mono">T</kbd><span>Today</span>
          <kbd className="font-mono">Y</kbd><span>First day of year</span>
          <kbd className="font-mono">R</kbd><span>Last day of year</span>
          <kbd className="font-mono">M</kbd><span>First day of month</span>
          <kbd className="font-mono">H</kbd><span>Last day of month</span>
          <kbd className="font-mono">+</kbd><span>Next day</span>
          <kbd className="font-mono">-</kbd><span>Previous day</span>
          <kbd className="font-mono">PgUp</kbd><span>Previous month</span>
          <kbd className="font-mono">PgDn</kbd><span>Next month</span>
        </span>
      </span>
    </span>
  );
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ onDateChange, onKeyDown, label, id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
      const currentValue = e.currentTarget.value;
      let newDate: Date | null = null;

      switch (e.key) {
        case 't':
        case 'T':
          newDate = new Date();
          break;
        case 'y':
        case 'Y': {
          const d = parseOrToday(currentValue);
          newDate = new Date(d.getFullYear(), 0, 1);
          break;
        }
        case 'r':
        case 'R': {
          const d = parseOrToday(currentValue);
          newDate = new Date(d.getFullYear(), 11, 31);
          break;
        }
        case 'm':
        case 'M': {
          const d = parseOrToday(currentValue);
          newDate = new Date(d.getFullYear(), d.getMonth(), 1);
          break;
        }
        case 'h':
        case 'H': {
          const d = parseOrToday(currentValue);
          // Day 0 of next month = last day of current month
          newDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          break;
        }
        case '+':
        case '=': {
          const d = parseOrToday(currentValue);
          if (!currentValue) {
            // If blank, put tomorrow
            d.setDate(d.getDate() + 1);
          } else {
            d.setDate(d.getDate() + 1);
          }
          newDate = d;
          break;
        }
        case '-': {
          const d = parseOrToday(currentValue);
          d.setDate(d.getDate() - 1);
          newDate = d;
          break;
        }
        case 'PageUp': {
          e.preventDefault();
          const d = parseOrToday(currentValue);
          newDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
          break;
        }
        case 'PageDown': {
          e.preventDefault();
          const d = parseOrToday(currentValue);
          newDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
          break;
        }
        default:
          break;
      }

      if (newDate) {
        e.preventDefault();
        const dateStr = getLocalDateString(newDate);
        onDateChange?.(dateStr);
      }

      onKeyDown?.(e);
    }, [onDateChange, onKeyDown]);

    return (
      <div className="w-full">
        {label && (
          <div className="flex items-center mb-1">
            <label
              htmlFor={inputId}
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {label}
            </label>
            <DateShortcutTooltip />
          </div>
        )}
        <Input
          ref={ref}
          id={inputId}
          type="date"
          onKeyDown={handleKeyDown}
          {...props}
        />
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';
