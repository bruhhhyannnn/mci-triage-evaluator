import { TopBar } from '../components/ui';
import { navigate } from '../lib/router';

export default function NotFound() {
  return (
    <main className="screen">
      <TopBar title="Sheet not found" onBack={() => navigate({ name: 'home' })} />
      <p className="empty">This sheet was deleted or is saved on another device.</p>
      <button type="button" className="btn primary block" onClick={() => navigate({ name: 'home' })}>
        Go home
      </button>
    </main>
  );
}
