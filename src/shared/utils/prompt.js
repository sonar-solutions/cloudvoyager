import { createInterface } from 'node:readline';

/**
 * Ask the user a question on the terminal and return their answer.
 * @param {string} question - The prompt text (include trailing space)
 * @returns {Promise<string>} The trimmed answer
 */
export function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt the user about an existing migration journal and decide whether to
 * resume, restart, or abort.
 *
 * @param {object} existingJournal - The loaded journal data
 * @param {string} currentSonarQubeUrl - The SQ URL from the current config
 * @returns {Promise<'resume'|'restart'|'abort'>}
 */
export async function promptMigrationResume(existingJournal, currentSonarQubeUrl) {
  const journalUrl = existingJournal.sonarqubeUrl || '(unknown)';
  const startedAt = existingJournal.startedAt || '(unknown)';
  const status = existingJournal.status || '(unknown)';

  const orgCount = Object.keys(existingJournal.organizations || {}).length;
  const completedOrgs = Object.values(existingJournal.organizations || {})
    .filter(o => o.status === 'completed').length;

  console.error('');
  console.error('┌─────────────────────────────────────────────────────────┐');
  console.error('│  Existing migration journal detected                    │');
  console.error('└─────────────────────────────────────────────────────────┘');
  console.error(`  Status:       ${status}`);
  console.error(`  Started:      ${startedAt}`);
  console.error(`  SonarQube:    ${journalUrl}`);
  console.error(`  Organizations: ${completedOrgs}/${orgCount} completed`);

  if (currentSonarQubeUrl && journalUrl !== '(unknown)' && journalUrl !== currentSonarQubeUrl) {
    console.error('');
    console.error('  ⚠  WARNING: SonarQube URL has changed!');
    console.error(`     Journal:  ${journalUrl}`);
    console.error(`     Current:  ${currentSonarQubeUrl}`);
    console.error('     Resuming with a different server may cause errors.');
  }

  // Non-interactive mode (e.g. spawned from desktop app with stdin closed):
  // auto-resume without prompting since the desktop UI already handled the choice.
  if (!process.stdin.isTTY) {
    console.error('');
    console.error('  Non-interactive mode detected — auto-resuming.');
    return 'resume';
  }

  console.error('');
  console.error('  [r] Resume  — continue from where the previous migration left off');
  console.error('  [f] Fresh   — discard previous state and start from scratch');
  console.error('  [a] Abort   — exit without doing anything');
  console.error('');

  const answer = await ask('  Choose [r/f/a] (default: r): ');

  switch (answer.toLowerCase()) {
    case 'f':
    case 'fresh':
    case 'restart':
      return 'restart';
    case 'a':
    case 'abort':
    case 'q':
    case 'quit':
      return 'abort';
    case 'r':
    case 'resume':
    case '':
      return 'resume';
    default:
      console.error(`  Unrecognized choice "${answer}", defaulting to resume.`);
      return 'resume';
  }
}
