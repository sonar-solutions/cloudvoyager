import test from 'ava';
import esmock from 'esmock';

// ---------------------------------------------------------------------------
// This test file deliberately does NOT register a custom module loader for
// .proto files.  Without such a loader, the dynamic imports inside
// loadProtoSchemas() (lines 17-18 of encoder.js) will fail with
// ERR_UNKNOWN_FILE_EXTENSION, causing execution to fall through to the
// catch block (lines 22-30) which uses readFileSync as a fallback.
//
// This covers the catch-block fallback path that is NOT exercised by
// protobuf.test.js (which registers a .proto loader to test the try path).
// ---------------------------------------------------------------------------

test('ProtobufEncoder loadSchemas uses readFileSync fallback when dynamic .proto imports fail', async (t) => {
  // Use esmock to get a fresh instance of encoder.js. No mocks are needed;
  // we just need a clean module load so loadProtoSchemas runs without the
  // custom .proto loader that protobuf.test.js registers.
  const { ProtobufEncoder } = await esmock('../../src/protobuf/encoder.js', {});

  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  // Verify that schemas loaded successfully via the readFileSync fallback
  t.truthy(encoder.root, 'should have loaded protobuf root');

  // Verify it can look up known message types from scanner-report.proto
  const componentType = encoder.root.lookupType('Component');
  t.truthy(componentType, 'should find Component type');

  const metadataType = encoder.root.lookupType('Metadata');
  t.truthy(metadataType, 'should find Metadata type');

  const issueType = encoder.root.lookupType('Issue');
  t.truthy(issueType, 'should find Issue type');

  // Verify it can look up an enum from constants.proto
  const severityEnum = encoder.root.lookupEnum('Severity');
  t.truthy(severityEnum, 'should find Severity enum from constants.proto');
});
