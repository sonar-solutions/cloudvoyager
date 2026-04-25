let results = [];
let hasFailure = false;

export function reset() {
  results = [];
  hasFailure = false;
}

export function pass(issueRef, message) {
  const line = `PASS: [${issueRef}] ${message}`;
  console.log(line);
  results.push({ status: 'PASS', issueRef, message });
}

export function fail(issueRef, message) {
  const line = `FAIL: [${issueRef}] ${message}`;
  console.error(line);
  results.push({ status: 'FAIL', issueRef, message });
  hasFailure = true;
}

export function summary() {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n--- ASSERTION SUMMARY ---`);
  console.log(`PASSED: ${passed}  FAILED: ${failed}  TOTAL: ${results.length}`);
  if (hasFailure) {
    console.error('\nFailed assertions:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.error(`  [${r.issueRef}] ${r.message}`);
    });
  }
  return { passed, failed, total: results.length, hasFailure };
}

export function exitWithResults() {
  const { hasFailure: failed } = summary();
  process.exit(failed ? 1 : 0);
}

export function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      parsed[args[i].slice(2)] = args[i + 1];
      i++;
    } else if (args[i].startsWith('--')) {
      parsed[args[i].slice(2)] = true;
    }
  }
  return parsed;
}
