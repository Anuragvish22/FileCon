import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { createTranslator, resolveLocale, type Translate } from '../../shared/i18n.ts';
import { applyTheme } from '../theme/apply.ts';
import { createActions, type Actions } from './actions.ts';
import { initialState, reducer } from './reducer.ts';
import type { State } from './state.ts';

interface Store {
  state: State;
  actions: Actions;
  translate: Translate;
}

const StoreContext = createContext<Store | null>(null);

export const useStore = (): Store => {
  const store = useContext(StoreContext);
  if (store === null) throw new Error('useStore needs <StoreProvider>');
  return store;
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const latest = useRef(state);
  latest.current = state;
  const actions = useMemo(
    () => createActions({ api: window.filecon, dispatch, getState: () => latest.current }),
    [],
  );

  // useCoreEvents (ARCHITECTURE section 13): the push channels, subscribed once for the whole app.
  useEffect(() => {
    const { filecon } = window;
    // The first push can land before this effect runs; ask once, and let a newer push win.
    let pushed = false;
    const stops = [
      filecon.on('core:status', (update) => {
        pushed = true;
        dispatch({ type: 'core/status', ...update });
      }),
      filecon.on('job:update', (job) => dispatch({ type: 'jobs/updated', job })),
      filecon.on('engines:changed', (engines) => dispatch({ type: 'engines/loaded', engines })),
    ];
    void filecon.coreStatus().then((update) => {
      if (!pushed) dispatch({ type: 'core/status', ...update });
    });
    return () => stops.forEach((stop) => stop());
  }, []);

  // Every transition to ready (first start and after a restart) re-runs the startup calls (P35).
  useEffect(() => {
    if (state.core.status === 'ready') void actions.startup();
  }, [state.core.status, state.core.restarts, actions]);

  const language = state.settings?.ui.language ?? 'system';
  const locale = resolveLocale(language, navigator.language);
  const translate = useMemo(() => createTranslator({ locale }), [locale]);

  const theme = state.settings?.ui.theme ?? 'system';
  const accent = state.settings?.ui.accent ?? 'teal';
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const apply = (): void =>
      applyTheme({
        root: document.documentElement,
        theme,
        accent,
        locale,
        prefersDark: query.matches,
      });
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme, accent, locale]);

  const store = useMemo(() => ({ state, actions, translate }), [state, actions, translate]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
};
