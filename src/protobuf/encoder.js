import protobuf from 'protobufjs';
import logger from '../utils/logger.js';
import { ProtobufEncodingError } from '../utils/errors.js';
import { encodeMessage, encodeMessageDelimited } from './encode-types.js';

/**
 * Load both proto schema files. Uses static-string import() calls so that
 * bundlers (esbuild, Bun) can resolve them at build time via their .proto
 * text loaders. Falls back to readFileSync for plain Node.js dev mode.
 *
 * NOTE: The import paths MUST be string literals (not template literals with
 * variables) so that Bun's bundler can statically analyse and inline them.
 */
async function loadProtoSchemas() {
  try {
    const [constantsMod, scannerReportMod] = await Promise.all([
      import('./schema/constants.proto'),
      import('./schema/scanner-report.proto'),
    ]);
    return [constantsMod.default, scannerReportMod.default];
  } catch {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    return [
      readFileSync(join(dir, 'schema', 'constants.proto'), 'utf-8'),
      readFileSync(join(dir, 'schema', 'scanner-report.proto'), 'utf-8'),
    ];
  }
}

export class ProtobufEncoder {
  root = null;

  async loadSchemas() {
    logger.info('Loading protobuf schemas...');
    try {
      const [constantsProtoText, scannerReportProtoText] = await loadProtoSchemas();
      const root = new protobuf.Root();
      protobuf.parse(constantsProtoText, root);
      const stripped = scannerReportProtoText.replace(/^import\s+"constants\.proto";\s*$/m, '');
      protobuf.parse(stripped, root);
      this.root = root;
      logger.info('Protobuf schemas loaded successfully');
    } catch (error) {
      throw new ProtobufEncodingError(`Failed to load protobuf schemas: ${error.message}`);
    }
  }

  encodeMetadata(m) { return encodeMessage(this.root, 'Metadata', m); }
  encodeComponent(c) { return encodeMessage(this.root, 'Component', c); }
  encodeIssueDelimited(i) { return encodeMessageDelimited(this.root, 'Issue', i); }
  encodeMeasureDelimited(m) { return encodeMessageDelimited(this.root, 'Measure', m); }
  encodeActiveRuleDelimited(r) { return encodeMessageDelimited(this.root, 'ActiveRule', r); }
  encodeChangeset(c) { return encodeMessage(this.root, 'Changesets', c); }

  encodeAll(messages) {
    logger.info('Encoding all messages to protobuf...');
    if (!this.root) {
      throw new ProtobufEncodingError('Schemas not loaded. Call loadSchemas() before encodeAll().');
    }
    try {
      const encoded = {
        metadata: this.encodeMetadata(messages.metadata),
        components: [],
        issues: new Map(),
        measures: new Map(),
        sourceFilesText: [],
        activeRules: null,
        changesets: new Map(),
      };

      logger.debug(`Encoding ${messages.components.length} components...`);
      messages.components.forEach(component => {
        encoded.components.push(this.encodeComponent(component));
      });

      logger.debug(`Encoding issues for ${messages.issuesByComponent.size} components...`);
      messages.issuesByComponent.forEach((issues, componentRef) => {
        const buffers = issues.map(issue => this.encodeIssueDelimited(issue));
        encoded.issues.set(componentRef, Buffer.concat(buffers));
      });

      logger.debug(`Encoding measures for ${messages.measuresByComponent.size} components...`);
      messages.measuresByComponent.forEach((measures, componentRef) => {
        const buffers = measures.map(measure => this.encodeMeasureDelimited(measure));
        encoded.measures.set(componentRef, Buffer.concat(buffers));
      });

      logger.debug(`Preparing ${messages.sourceFiles.length} source files as plain text...`);
      encoded.sourceFilesText = [];
      messages.sourceFiles.forEach(sourceFile => {
        const textContent = sourceFile.lines.map(line => line.source).join('\n');
        encoded.sourceFilesText.push({ componentRef: sourceFile.componentRef, text: textContent });
      });

      logger.debug(`Encoding ${messages.activeRules.length} active rules...`);
      const activeRuleBuffers = messages.activeRules.map(activeRule =>
        this.encodeActiveRuleDelimited(activeRule)
      );
      encoded.activeRules = Buffer.concat(activeRuleBuffers);

      logger.debug(`Encoding changesets for ${messages.changesetsByComponent.size} components...`);
      messages.changesetsByComponent.forEach((changeset, componentRef) => {
        encoded.changesets.set(componentRef, this.encodeChangeset(changeset));
      });

      logger.info('All messages encoded successfully');
      return encoded;
    } catch (error) {
      throw new ProtobufEncodingError(`Failed to encode messages: ${error.message}`);
    }
  }
}
