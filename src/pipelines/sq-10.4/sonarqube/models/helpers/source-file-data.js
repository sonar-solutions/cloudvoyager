// -------- Main Logic --------

// Data model for a SonarQube source file with line counting.
export class SourceFileData {
  constructor(fileKey, content, language = '') {
    this.key = fileKey;
    this.content = content;
    this.lines = content.split('\n');
    this.language = language;
  }

  get lineCount() {
    // A file with a trailing newline (e.g. "a\nb\n") splits into ['a','b','']
    // which has 3 elements but only 2 actual lines.
    const len = this.lines.length;
    if (len > 1 && this.lines[len - 1] === '') return len - 1;
    return len;
  }
}
