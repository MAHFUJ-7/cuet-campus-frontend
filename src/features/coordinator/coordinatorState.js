// Coordinator shared state — port of the shell's ValueNotifier<String?>
// selectedTermId. Null means "entire authorized scope". Shared by Home,
// Academics, Students and Exams so the term filter survives navigation.
import { useSyncExternalStore } from 'react';

let selectedTermId = null;
const listeners = new Set();

export function setSelectedTermId(value) {
  const next = value ?? null;
  if (next === selectedTermId) return;
  selectedTermId = next;
  listeners.forEach((listener) => listener());
}

export function getSelectedTermId() {
  return selectedTermId;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns [termId, setTermId]; re-renders when the shared value changes. */
export function useSelectedTerm() {
  const value = useSyncExternalStore(subscribe, getSelectedTermId, getSelectedTermId);
  return [value, setSelectedTermId];
}
