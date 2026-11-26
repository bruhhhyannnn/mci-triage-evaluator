import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Icon, type IconName } from './components/Icon';
import { ToastHost } from './components/ui';
import { haptic, setHapticsEnabled } from './lib/haptics';
import { requestPersistentStorage } from './lib/install';
import { navigate, useRoute, type Route } from './lib/router';
import { useAppState, type Appearance } from './lib/store';
import Home from './screens/Home';
import Results from './screens/Results';
import Scoring from './screens/Scoring';
import SheetResults from './screens/SheetResults';

const TABS: { route: Route; label: string; icon: IconName }[] = [
  { route: { name: 'home' }, label: 'Evaluate', icon: 'clipboard-check' },
  { route: { name: 'results' }, label: 'Results', icon: 'chart-column' },
];

/** The design system's floating TabBar. */
function TabBar({ current }: { current: Route['name'] }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((tab) => {
        const active = tab.route.name === current;
        return (
          <button
            key={tab.label}
            type="button"
            className={active ? 'active' : ''}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              if (!active) haptic('select');
              navigate(tab.route);
            }}
          >
            <span className="tab-pill">
              <Icon name={tab.icon} size={20} />
            </span>
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
      <button type="button" className="btn primary sm" onClick={() => updateServiceWorker(true)}>
        Update
      </button>
    </div>
  );
}

const THEME_COLOR = { light: '#eef4fb', dark: '#0b1628' };

/** Applies the Appearance setting (Light · Dark · Match phone) to <html data-theme>. */
function useAppearance(appearance: Appearance) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme = appearance === 'system' ? (media.matches ? 'dark' : 'light') : appearance;
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [appearance]);
}

export default function App() {
  const route = useRoute();
  const storageError = useAppState((s) => s.storageError);
  const settings = useAppState((s) => s.settings);
  useAppearance(settings.appearance);

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);

  // Scores live only on this device: ask the browser not to evict them under storage pressure.
  const hasData = useAppState((s) => Object.keys(s.evaluations).length > 0);
  useEffect(() => {
    if (hasData) requestPersistentStorage();
  }, [hasData]);

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
      {tabbed && <TabBar current={route.name} />}
      <ToastHost />
    </div>
  );
}
