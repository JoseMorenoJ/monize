import { ReactNode } from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Action buttons to render on the right side */
  actions?: ReactNode;
  /** URL to the wiki help page for this feature */
  helpUrl?: string;
}

/**
 * Inline page header with title, subtitle, and action buttons.
 * Renders directly in the content area without a separate background bar.
 */
export function PageHeader({ title, subtitle, actions, helpUrl }: PageHeaderProps) {
  return (
    <div className={`${actions ? 'flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4' : ''} mb-6`}>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          {helpUrl && (
            <a
              href={helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-500 transition-colors"
              aria-label="Help"
            >
              <QuestionMarkCircleIcon className="h-5 w-5" />
            </a>
          )}
        </div>
        {subtitle && (
          <p className="text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto [&>*]:w-full [&>*]:sm:w-auto">{actions}</div>}
    </div>
  );
}
