// The current deployment has one game-server replica. Keep its asynchronous
// ticks and socket mutations in order so a power-up cannot race its next call.
const pending = new Map<string, Promise<unknown>>();

export async function withRoomLock<T>(code: string, action: () => Promise<T>): Promise<T> {
  const previous = pending.get(code) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(action);
  pending.set(code, next);
  try {
    return await next;
  } finally {
    if (pending.get(code) === next) pending.delete(code);
  }
}
