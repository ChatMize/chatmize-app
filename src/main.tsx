import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { WaitlistPage } from './views/WaitlistPage';
import './index.css';

// Public waitlist page: served at /waitlist (hosting rewrites ** to
// index.html). Renders before the auth gate so visitors never need to log in.
const isWaitlistRoute =
  typeof window !== 'undefined' && window.location.pathname === '/waitlist';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isWaitlistRoute ? <WaitlistPage /> : <App />}
  </StrictMode>,
);
