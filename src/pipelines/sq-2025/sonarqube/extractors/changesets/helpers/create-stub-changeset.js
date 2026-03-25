// -------- Create Stub Changeset --------

const STUB_REVISION = 'cloudvoyager000000000000000000000000000';
const STUB_AUTHOR = 'cloudvoyager-migration@sonarcloud.io';

/** Create minimal changeset data for a single file. */
export function createStubChangeset(lineCount) {
  const timestamp = Date.now();

  return {
    componentRef: null, // Will be set by builder
    changesets: [{
      revision: STUB_REVISION,
      author: STUB_AUTHOR,
      date: timestamp,
    }],
    changesetIndexByLine: new Array(lineCount).fill(0),
  };
}
