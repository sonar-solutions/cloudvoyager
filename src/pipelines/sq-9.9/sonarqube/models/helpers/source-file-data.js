// -------- Source File Data Model --------

export class SourceFileData {
  constructor(fileKey, content, language = '') {
    this.key = fileKey;
    this.content = content;
    this.lines = content.split('\n');
    this.language = language;
  }

  get lineCount() {
    return this.lines.length;
  }
}
