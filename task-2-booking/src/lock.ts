// Очередь задач по ключу: задачи с одним ключом выполняются строго по одной.
// Работает в пределах одного процесса Node.
export function createKeyedLock() {
  const tails = new Map<string, Promise<void>>();

  return async function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const run = previous.then(task);
    // следующая задача ждёт окончания этой, даже если эта упала
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    tails.set(key, tail);
    try {
      return await run;
    } finally {
      if (tails.get(key) === tail) tails.delete(key);
    }
  };
}