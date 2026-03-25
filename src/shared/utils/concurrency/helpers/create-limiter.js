// -------- Create Concurrency Limiter --------
export function createLimiter(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    while (queue.length > 0 && active < concurrency) {
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn().then(resolve, reject).finally(() => { active--; next(); });
    }
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}
