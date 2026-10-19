import { createRoot } from 'react-dom/client';
import { AppShell } from './components/AppShell.tsx';
import { StoreProvider } from './store/context.tsx';
import './styles.css';

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no #root');
// The pages land in M1-7b and M1-7c.
createRoot(root).render(
  <StoreProvider>
    <AppShell>{null}</AppShell>
  </StoreProvider>,
);
