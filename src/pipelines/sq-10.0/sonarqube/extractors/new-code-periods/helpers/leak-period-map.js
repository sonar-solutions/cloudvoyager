// -------- Leak Period Map --------

export const LEAK_PERIOD_MAP = {
  'NUMBER_OF_DAYS': (period) => [
    { key: 'sonar.leak.period', value: period.value },
    { key: 'sonar.leak.period.type', value: 'days' },
  ],
  'PREVIOUS_VERSION': () => [
    { key: 'sonar.leak.period', value: 'previous_version' },
    { key: 'sonar.leak.period.type', value: 'previous_version' },
  ],
};
