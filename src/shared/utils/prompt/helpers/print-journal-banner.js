// -------- Print Journal Banner --------
export function printJournalBanner(existingJournal, currentSonarQubeUrl) {
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
}
