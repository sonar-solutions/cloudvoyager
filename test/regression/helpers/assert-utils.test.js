import test from 'ava';

test.serial('pass() and fail() record results, summary() reports them', async t => {
  const mod = await import('./assert-utils.js');
  mod.reset();

  mod.pass('#98', 'Test pass message');
  mod.fail('#53', 'Test fail message');

  const result = mod.summary();
  t.is(result.passed, 1);
  t.is(result.failed, 1);
  t.is(result.total, 2);
  t.true(result.hasFailure);

  mod.reset();
});

test.serial('reset() clears all state', async t => {
  const mod = await import('./assert-utils.js');
  mod.reset();

  mod.pass('#1', 'first');
  mod.fail('#2', 'second');
  mod.reset();

  const result = mod.summary();
  t.is(result.total, 0);
  t.false(result.hasFailure);

  mod.reset();
});

test.serial('parseArgs() extracts --key value pairs and boolean flags', async t => {
  const originalArgv = process.argv;
  try {
    process.argv = ['node', 'script.js', '--config', 'migrate-config.json', '--verbose'];
    const mod = await import('./assert-utils.js');
    const args = mod.parseArgs();
    t.is(args.config, 'migrate-config.json');
    t.is(args.verbose, true);
  } finally {
    process.argv = originalArgv;
  }
});
