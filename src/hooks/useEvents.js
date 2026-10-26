// React binding for the local-first event store.
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { eventStore } from '../lib/eventStore.js';

export function useVisibleEvents() {
  const auth = useAuth();
  const [version, setVersion] = useState(0);

  useEffect(() => eventStore.subscribe(() => setVersion((value) => value + 1)), []);

  return useMemo(
    () => eventStore.visibleFor(auth),
    // Re-read when the viewer or the stored events change.
    [
      version,
      auth.profile?.id,
      auth.profile?.section?.name,
      auth.isCoordinator,
      auth.isAdmin,
      auth.isCR,
    ]
  );
}
