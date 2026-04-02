// -------- Build Header --------

/** Build the title and metadata section for the rules comparison PDF. */
export function buildHeader(data) {
  return [
    { text: 'Rules Comparison Report — SonarQube vs SonarCloud', style: 'title' },
    { text: `Generated: ${data.generatedAt}`, style: 'metadata' },
    {
      text: 'Compares the full set of rules available in SonarQube against SonarCloud by Rule ID.',
      style: 'metadata', margin: [0, 0, 0, 10],
    },
  ];
}
