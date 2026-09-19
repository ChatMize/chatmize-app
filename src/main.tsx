import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// WaitlistPage is its own chunk: app users never download it, and public
// visitors on /waitlist never download the app shell's views.
const WaitlistPage = lazy(() => import('./views/WaitlistPage').then(m => ({ default: m.WaitlistPage })));
import './index.css';

// Public waitlist page: served at /waitlist (hosting rewrites ** to
// index.html). Renders before the auth gate so visitors never need to log in.
const isWaitlistRoute =
  typeof window !== 'undefined' && window.location.pathname === '/waitlist';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isWaitlistRoute ? (
      <Suspense fallback={null}>
        <WaitlistPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
