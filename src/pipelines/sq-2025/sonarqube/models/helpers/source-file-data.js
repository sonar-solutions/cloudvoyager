// -------- Source File Data Model --------

export class SourceFileData {
  constructor(fileKey, content, language = '') {
    this.key = fileKey;
    this.content = content;
    this.lines = content.split('\n');
    this.language = language;
  }

  get lineCount() {
    // A file with a trailing newline (e.g. "a\nb\n") splits into ['a','b','']
    // which has 3 elements but only 2 actual lines. Adjust when the last
    // element is an empty string caused by a trailing newline.
    const len = this.lines.length;
    if (len > 1 && this.lines[len - 1] === '') {
      return len - 1;
    }
    return len;
  }
}
