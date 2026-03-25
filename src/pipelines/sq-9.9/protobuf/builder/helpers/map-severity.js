// -------- Map SonarQube Severity to Protobuf Enum Value --------

export function mapSeverity(severity) {
  const severityMap = { 'INFO': 1, 'MINOR': 2, 'MAJOR': 3, 'CRITICAL': 4, 'BLOCKER': 5 };
  return severityMap[severity] || 3;
}
