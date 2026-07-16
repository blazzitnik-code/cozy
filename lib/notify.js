// Tiny pub/sub for user-facing error notifications (rendered by <Toaster /> in ui.js).
// Kept dependency-free so lib/hooks.js can report failed DB writes without touching React.

const listeners = new Set();

export function notifyError(message) {
  listeners.forEach(fn => fn(message));
}

export function subscribeToErrors(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
