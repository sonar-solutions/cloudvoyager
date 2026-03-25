// -------- Prompt Migration Resume --------
import { ask } from './ask.js';
import { printJournalBanner } from './print-journal-banner.js';
import { parseResumeChoice } from './parse-resume-choice.js';

export async function promptMigrationResume(existingJournal, currentSonarQubeUrl) {
  printJournalBanner(existingJournal, currentSonarQubeUrl);

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
  return parseResumeChoice(answer);
}
