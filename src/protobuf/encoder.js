import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import protobuf from 'protobufjs';
import logger from '../utils/logger.js';
import { ProtobufEncodingError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const constantsProtoText = readFileSync(join(__dirname, 'schema', 'constants.proto'), 'utf-8');
const scannerReportProtoText = readFileSync(join(__dirname, 'schema', 'scanner-report.proto'), 'utf-8');

/**
 * Encode data to protobuf format
 */
export class ProtobufEncoder {
  root = null;

  /**
   * Load protobuf schemas from inlined proto text (no filesystem access needed).
   */
  async loadSchemas() {
    logger.info('Loading protobuf schemas...');

    try {
      const root = new protobuf.Root();
      // Parse constants first (defines Severity enum), then scanner-report which references it.
      protobuf.parse(constantsProtoText, root);
      // Strip the import directive — the types are already in the root.
      const stripped = scannerReportProtoText.replace(/^import\s+"constants\.proto";\s*$/m, '');
      protobuf.parse(stripped, root);
      this.root = root;

      logger.info('Protobuf schemas loaded successfully');
    } catch (error) {
      throw new ProtobufEncodingError(`Failed to load protobuf schemas: ${error.message}`);
    }
  }

  /**
   * Encode metadata message (single message, NOT length-delimited)
   */
  encodeMetadata(metadata) {
    const Metadata = this.root.lookupType('Metadata');
    const errMsg = Metadata.verify(metadata);

    if (errMsg) {
      throw new ProtobufEncodingError(`Metadata validation failed: ${errMsg}`);
    }

    const message = Metadata.create(metadata);
    return Metadata.encode(message).finish();
  }

  /**
   * Encode component message (single message per file, NOT length-delimited)
   */
  encodeComponent(component) {
    const Component = this.root.lookupType('Component');
    const errMsg = Component.verify(component);

    if (errMsg) {
      throw new ProtobufEncodingError(`Component validation failed: ${errMsg}`);
    }

    const message = Component.create(component);
    return Component.encode(message).finish();
  }

  /**
   * Encode a single issue message with length-delimited prefix
   */
  encodeIssueDelimited(issue) {
    const Issue = this.root.lookupType('Issue');
    const errMsg = Issue.verify(issue);

    if (errMsg) {
      throw new ProtobufEncodingError(`Issue validation failed: ${errMsg}`);
    }

    const message = Issue.create(issue);
    return Issue.encodeDelimited(message).finish();
  }

  /**
   * Encode a single measure message with length-delimited prefix
   */
  encodeMeasureDelimited(measure) {
    const Measure = this.root.lookupType('Measure');
    const errMsg = Measure.verify(measure);

    if (errMsg) {
      throw new ProtobufEncodingError(`Measure validation failed: ${errMsg}`);
    }

    const message = Measure.create(measure);
    return Measure.encodeDelimited(message).finish();
  }

  /**
   * Encode a single active rule message with length-delimited prefix
   */
  encodeActiveRuleDelimited(activeRule) {
    const ActiveRule = this.root.lookupType('ActiveRule');
    const errMsg = ActiveRule.verify(activeRule);

    if (errMsg) {
      throw new ProtobufEncodingError(`ActiveRule validation failed: ${errMsg}`);
    }

    const message = ActiveRule.create(activeRule);
    return ActiveRule.encodeDelimited(message).finish();
  }

  /**
   * Encode changeset message (single message per file, NOT length-delimited)
   */
  encodeChangeset(changeset) {
    const Changesets = this.root.lookupType('Changesets');
    const errMsg = Changesets.verify(changeset);

    if (errMsg) {
      throw new ProtobufEncodingError(`Changesets validation failed: ${errMsg}`);
    }

    const message = Changesets.create(changeset);
    return Changesets.encode(message).finish();
  }

  /**
   * Encode all messages from builder output
   * @param {object} messages - Output from ProtobufBuilder.buildAll()
   * @returns {object} Encoded protobuf messages as buffers
   */
  encodeAll(messages) {
    logger.info('Encoding all messages to protobuf...');

    if (!this.root) {
      throw new ProtobufEncodingError('Schemas not loaded. Call loadSchemas() before encodeAll().');
    }

    try {
      const encoded = {
        metadata: this.encodeMetadata(messages.metadata),
        components: [],
        issues: new Map(),       // Map<componentRef, Buffer> (length-delimited concatenated)
        measures: new Map(),     // Map<componentRef, Buffer> (length-delimited concatenated)
        sourceFilesText: [],
        activeRules: null,       // Single Buffer (length-delimited concatenated)
        changesets: new Map(),
      };

      // Encode components (one file per component, NOT length-delimited)
      logger.debug(`Encoding ${messages.components.length} components...`);
      messages.components.forEach(component => {
        encoded.components.push(this.encodeComponent(component));
      });

      // Encode issues - length-delimited, concatenated per component
      logger.debug(`Encoding issues for ${messages.issuesByComponent.size} components...`);
      messages.issuesByComponent.forEach((issues, componentRef) => {
        const buffers = issues.map(issue => this.encodeIssueDelimited(issue));
        encoded.issues.set(componentRef, Buffer.concat(buffers));
      });

      // Encode measures - length-delimited individual Measure messages per component
      logger.debug(`Encoding measures for ${messages.measuresByComponent.size} components...`);
      messages.measuresByComponent.forEach((measures, componentRef) => {
        const buffers = measures.map(measure => this.encodeMeasureDelimited(measure));
        encoded.measures.set(componentRef, Buffer.concat(buffers));
      });

      // Source files as plain text
      logger.debug(`Preparing ${messages.sourceFiles.length} source files as plain text...`);
      encoded.sourceFilesText = [];
      messages.sourceFiles.forEach(sourceFile => {
        const textContent = sourceFile.lines.map(line => line.source).join('\n');
        encoded.sourceFilesText.push({
          componentRef: sourceFile.componentRef,
          text: textContent
        });
      });

      // Encode active rules - length-delimited, all concatenated into one buffer
      logger.debug(`Encoding ${messages.activeRules.length} active rules...`);
      const activeRuleBuffers = messages.activeRules.map(activeRule =>
        this.encodeActiveRuleDelimited(activeRule)
      );
      encoded.activeRules = Buffer.concat(activeRuleBuffers);

      // Encode changesets (single Changesets message per component, NOT length-delimited)
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
