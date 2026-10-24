import type { ReactNode } from 'react';
import { useStore } from '../store/context.tsx';
import type { Page } from '../store/state.ts';
import { Button } from './ui/Button.tsx';
import { CoreBanner } from './CoreBanner.tsx';
import { Mark } from './Mark.tsx';

const PAGES: readonly Page[] = ['files', 'engines', 'settings'];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { state, actions, translate } = useStore();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Mark className="size-6" />
          {translate('app.title')}
        </h1>
        <nav aria-label={translate('nav.label')} className="flex gap-1 rounded-card bg-surface p-1">
          {PAGES.map((page) => (
            <button
              key={page}
              type="button"
              aria-current={state.page === page ? 'page' : undefined}
              onClick={() => actions.setPage(page)}
              className="h-8 rounded-control px-3 text-sm font-medium text-muted transition-colors hover:text-fg aria-[current=page]:bg-surface-raised aria-[current=page]:text-fg aria-[current=page]:shadow-sm"
            >
              {translate(`nav.${page}`)}
            </button>
          ))}
        </nav>
      </header>
      <CoreBanner />
      {state.notice !== null && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 border-b border-info-border bg-info-subtle px-6 py-2 text-sm text-info"
        >
          <span>{translate(state.notice.key, state.notice.params)}</span>
          <Button variant="ghost" size="sm" onClick={actions.dismissNotice}>
            {translate('notice.dismiss')}
          </Button>
        </div>
      )}
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">{children}</main>
    </div>
  );
};
