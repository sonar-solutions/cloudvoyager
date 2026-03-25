import { encodeMessage, encodeMessageDelimited } from '../encode-types.js';
import { loadSchemas } from './helpers/load-proto-schemas.js';
import { encodeAll } from './helpers/encode-all.js';

// -------- Factory Function --------

export function createProtobufEncoder() {
  const ctx = { root: null };
  ctx.loadSchemas = async () => { ctx.root = await loadSchemas(); };
  ctx.encodeMetadata = (m) => encodeMessage(ctx.root, 'Metadata', m);
  ctx.encodeComponent = (c) => encodeMessage(ctx.root, 'Component', c);
  ctx.encodeIssueDelimited = (i) => encodeMessageDelimited(ctx.root, 'Issue', i);
  ctx.encodeMeasureDelimited = (m) => encodeMessageDelimited(ctx.root, 'Measure', m);
  ctx.encodeActiveRuleDelimited = (r) => encodeMessageDelimited(ctx.root, 'ActiveRule', r);
  ctx.encodeChangeset = (c) => encodeMessage(ctx.root, 'Changesets', c);
  ctx.encodeExternalIssueDelimited = (i) => encodeMessageDelimited(ctx.root, 'ExternalIssue', i);
  ctx.encodeAdHocRuleDelimited = (r) => encodeMessageDelimited(ctx.root, 'AdHocRule', r);
  ctx.encodeDuplicationDelimited = (d) => encodeMessageDelimited(ctx.root, 'Duplication', d);
  ctx.encodeAll = (messages) => encodeAll(ctx, messages);
  return ctx;
}

// -------- Class Wrapper (backward compat) --------

export class ProtobufEncoder {
  constructor() {
    Object.assign(this, createProtobufEncoder());
  }
}
