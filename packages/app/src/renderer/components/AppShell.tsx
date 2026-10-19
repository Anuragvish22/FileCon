import type { ReactNode } from 'react';
import { useStore } from '../store/context.tsx';
import type { Page } from '../store/state.ts';
import { CoreBanner } from './CoreBanner.tsx';

const PAGES: readonly Page[] = ['convert', 'engines', 'settings'];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { state, actions, translate } = useStore();
  return (
    <div className="shell">
      <header>
        <h1>{translate('app.title')}</h1>
        <nav aria-label={translate('nav.label')}>
          {PAGES.map((page) => (
            <button
              key={page}
              type="button"
              aria-current={state.page === page ? 'page' : undefined}
              onClick={() => actions.setPage(page)}
            >
              {translate(`nav.${page}`)}
            </button>
          ))}
        </nav>
      </header>
      <CoreBanner />
      {state.notice !== null && (
        <div role="status" className="notice">
          <span>{translate(state.notice.key, state.notice.params)}</span>
          <button type="button" onClick={actions.dismissNotice}>
            {translate('notice.dismiss')}
          </button>
        </div>
      )}
      <main>{children}</main>
    </div>
  );
};
