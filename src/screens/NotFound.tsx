import { EmptyState, TopBar } from '../components/ui';
import { navigate } from '../lib/router';

export default function NotFound() {
  return (
    <main className="screen">
      <TopBar title="Sheet not found" onBack={() => navigate({ name: 'home' })} />
      <EmptyState
        icon="alert-triangle"
        title="This sheet isn't on this device"
        body="It was deleted, or it was scored on another phone."
        action={
          <button type="button" className="btn primary" onClick={() => navigate({ name: 'home' })}>
            Go to Evaluate
          </button>
        }
      />
    </main>
  );
}
