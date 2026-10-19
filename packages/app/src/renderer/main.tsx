import { createRoot } from 'react-dom/client';
import { AppShell } from './components/AppShell.tsx';
import { JobsPanel } from './components/JobsPanel.tsx';
import { ConvertPage } from './pages/ConvertPage.tsx';
import { EnginesPage } from './pages/EnginesPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { StoreProvider, useStore } from './store/context.tsx';
import './styles.css';

const Page = () => {
  const { state } = useStore();
  if (state.page === 'engines') return <EnginesPage />;
  if (state.page === 'settings') return <SettingsPage />;
  return (
    <>
      <ConvertPage />
      <JobsPanel />
    </>
  );
};

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no #root');
createRoot(root).render(
  <StoreProvider>
    <AppShell>
      <Page />
    </AppShell>
  </StoreProvider>,
);
