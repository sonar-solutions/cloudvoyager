// -------- Build Stub Changeset --------

const STUB_REVISION = 'cloudvoyager000000000000000000000000000';
const STUB_AUTHOR = 'cloudvoyager-migration@sonarcloud.io';

export function buildStubChangeset(lineCount) {
  return {
    componentRef: null, // Will be set by builder
    changesets: [{
      revision: STUB_REVISION,
      author: STUB_AUTHOR,
      date: Date.now()
    }],
    changesetIndexByLine: new Array(lineCount).fill(0)
  };
}
