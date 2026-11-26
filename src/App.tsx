import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ToastHost } from './components/ui';
import { navigate, useRoute, type Route } from './lib/router';
import { useAppState } from './lib/store';
import Home from './screens/Home';
import Results from './screens/Results';
import Scoring from './screens/Scoring';
import SheetResults from './screens/SheetResults';

const TABS: { route: Route; label: string; icon: string }[] = [
  { route: { name: 'home' }, label: 'Evaluate', icon: 'M12 5v14M5 12h14' },
  { route: { name: 'results' }, label: 'Results', icon: 'M5 19V11M12 19V5M19 19v-6' },
];

function BottomNav({ current }: { current: Route['name'] }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((tab) => {
        const active = tab.route.name === current;
        return (
          <button
            key={tab.label}
            type="button"
            className={active ? 'active' : ''}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(tab.route)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d={tab.icon} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      <span>A new version is ready.</span>
      <button type="button" className="btn small primary" onClick={() => updateServiceWorker(true)}>
        Update
      </button>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const storageError = useAppState((s) => s.storageError);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  const tabbed = route.name === 'home' || route.name === 'results';

  let screen;
  switch (route.name) {
    case 'score':
      screen = <Scoring id={route.id} method={route.method} />;
      break;
    case 'sheet':
      screen = <SheetResults id={route.id} />;
      break;
    case 'results':
      screen = <Results />;
      break;
    default:
      screen = <Home />;
  }

  return (
    <div className={`app ${tabbed ? 'with-nav' : 'focused'}`}>
      <UpdateBanner />
      {storageError && (
        <div className="storage-error" role="alert">
          {storageError}
        </div>
      )}
      {screen}
      {tabbed && <BottomNav current={route.name} />}
      <ToastHost />
    </div>
  );
}
