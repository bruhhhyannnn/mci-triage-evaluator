import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ToastHost } from './components/ui';
import { navigate, useRoute, type Route } from './lib/router';
import { useAppState } from './lib/store';
import Home from './screens/Home';
import MethodReview from './screens/MethodReview';
import MethodRun from './screens/MethodRun';
import Records from './screens/Records';
import Roster from './screens/Roster';
import Setup from './screens/Setup';
import Summary from './screens/Summary';
import Trainee from './screens/Trainee';

const TABS: { route: Route; label: string; icon: string; match: Route['name'][] }[] = [
  { route: { name: 'home' }, label: 'Evaluate', icon: 'M5 12l4 4L19 6', match: ['home', 'setup', 'trainee'] },
  { route: { name: 'records' }, label: 'Records', icon: 'M5 6h14M5 12h14M5 18h9', match: ['records'] },
  {
    route: { name: 'roster' },
    label: 'Roster',
    icon: 'M9 11a3 3 0 100-6 3 3 0 000 6zm-5 8c0-3 2.2-5 5-5s5 2 5 5M16 11a3 3 0 100-6M20 19c0-2.4-1.3-4.2-3.3-4.8',
    match: ['roster'],
  },
];

function BottomNav({ current }: { current: Route['name'] }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((tab) => {
        const active = tab.match.includes(current);
        return (
          <button
            key={tab.label}
            type="button"
            className={active ? 'active' : ''}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(tab.route)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d={tab.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  const hasDrill = useAppState((s) => !!s.drill);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  // First launch: set up the drill before anything else.
  const effective: Route = !hasDrill && (route.name === 'home' || route.name === 'trainee') ? { name: 'setup' } : route;
  const focused = effective.name === 'run' || effective.name === 'review' || effective.name === 'summary';

  let screen;
  switch (effective.name) {
    case 'setup':
      screen = <Setup firstRun={!hasDrill} />;
      break;
    case 'trainee':
      screen = <Trainee />;
      break;
    case 'run':
      screen = <MethodRun id={effective.id} method={effective.method} />;
      break;
    case 'review':
      screen = <MethodReview id={effective.id} method={effective.method} />;
      break;
    case 'summary':
      screen = <Summary id={effective.id} />;
      break;
    case 'records':
      screen = <Records />;
      break;
    case 'roster':
      screen = <Roster />;
      break;
    default:
      screen = <Home />;
  }

  return (
    <div className={`app ${focused ? 'focused' : 'with-nav'}`}>
      <UpdateBanner />
      {storageError && (
        <div className="storage-error" role="alert">
          {storageError}
        </div>
      )}
      {screen}
      {!focused && hasDrill && <BottomNav current={effective.name} />}
      <ToastHost />
    </div>
  );
}
