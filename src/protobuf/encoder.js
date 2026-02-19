import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import protobuf from 'protobufjs';
import logger from '../utils/logger.js';
import { ProtobufEncodingError } from '../utils/errors.js';
import { encodeMessage, encodeMessageDelimited } from './encode-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const constantsProtoText = readFileSync(join(__dirname, 'schema', 'constants.proto'), 'utf-8');
const scannerReportProtoText = readFileSync(join(__dirname, 'schema', 'scanner-report.proto'), 'utf-8');

export class ProtobufEncoder {
  root = null;

  async loadSchemas() {
    logger.info('Loading protobuf schemas...');
    try {
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
