/**
 * Worker thread for CPU-intensive protobuf encoding.
 * Loads schemas and encodes messages independently of the main thread.
 */
import { parentPort, workerData } from 'node:worker_threads';
import protobuf from 'protobufjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

(async () => {
  try {
    const schemaPath = join(__dirname, 'schema', 'scanner-report.proto');
    const root = await protobuf.load(schemaPath);

    const messages = workerData;

    // Reconstruct Maps from serialized [key, value] arrays
    const issuesByComponent = new Map(messages.issuesByComponent);
    const measuresByComponent = new Map(messages.measuresByComponent);
    const changesetsByComponent = new Map(messages.changesetsByComponent);

    const Metadata = root.lookupType('Metadata');
    const Component = root.lookupType('Component');
    const Issue = root.lookupType('Issue');
    const Measure = root.lookupType('Measure');
    const ActiveRule = root.lookupType('ActiveRule');
    const Changesets = root.lookupType('Changesets');

    // Encode metadata
    const metadata = Metadata.encode(Metadata.create(messages.metadata)).finish();

    // Encode components
    const components = messages.components.map(c =>
      Component.encode(Component.create(c)).finish()
    );

    // Encode issues per component
    const issues = [];
    for (const [componentRef, issueList] of issuesByComponent) {
      const buffers = issueList.map(issue =>
        Issue.encodeDelimited(Issue.create(issue)).finish()
      );
      issues.push([componentRef, Buffer.concat(buffers)]);
    }

    // Encode measures per component
    const measures = [];
    for (const [componentRef, measureList] of measuresByComponent) {
      const buffers = measureList.map(measure =>
        Measure.encodeDelimited(Measure.create(measure)).finish()
      );
      measures.push([componentRef, Buffer.concat(buffers)]);
    }

    // Source files as plain text
    const sourceFilesText = messages.sourceFiles.map(sourceFile => ({
      componentRef: sourceFile.componentRef,
      text: sourceFile.lines.map(line => line.source).join('\n')
    }));

    // Encode active rules
    const activeRuleBuffers = messages.activeRules.map(activeRule =>
      ActiveRule.encodeDelimited(ActiveRule.create(activeRule)).finish()
    );
    const activeRules = Buffer.concat(activeRuleBuffers);

    // Encode changesets per component
    const changesets = [];
    for (const [componentRef, changeset] of changesetsByComponent) {
      changesets.push([componentRef, Changesets.encode(Changesets.create(changeset)).finish()]);
    }

    parentPort.postMessage({
      metadata,
      components,
      issues,
      measures,
      sourceFilesText,
      activeRules,
      changesets
    });
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
})();
