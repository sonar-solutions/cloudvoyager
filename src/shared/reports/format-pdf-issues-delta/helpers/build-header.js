// -------- Build Header --------

/** Build the title and metadata section for the issues delta PDF. */
export function buildHeader(data) {
  return [
    { text: 'Project Issues Delta Report', style: 'title' },
    { text: `Generated: ${data.generatedAt}`, style: 'metadata' },
    {
      text: 'Compares actual issues between SonarQube and SonarCloud per project after migration. Differences are caused by rule changes between quality profiles.',
      style: 'metadata', margin: [0, 0, 0, 10],
    },
  ];
}
