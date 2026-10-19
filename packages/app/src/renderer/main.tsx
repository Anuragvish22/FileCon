import { createRoot } from 'react-dom/client';
import { AppShell } from './components/AppShell.tsx';
import { ConvertPage } from './pages/ConvertPage.tsx';
import { StoreProvider, useStore } from './store/context.tsx';
import './styles.css';

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no #root');
// The Engines and Settings pages land in M1-7c.
const Page = () => {
  const { state, translate } = useStore();
  return state.page === 'convert' ? <ConvertPage /> : <p>{translate('page.soon')}</p>;
};

createRoot(root).render(
  <StoreProvider>
    <AppShell>
      <Page />
    </AppShell>
  </StoreProvider>,
);
