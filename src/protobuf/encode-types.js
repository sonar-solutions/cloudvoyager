import { ProtobufEncodingError } from '../utils/errors.js';

export function encodeMessage(root, typeName, data) {
  const Type = root.lookupType(typeName);
  const errMsg = Type.verify(data);
  if (errMsg) throw new ProtobufEncodingError(`${typeName} validation failed: ${errMsg}`);
  const message = Type.create(data);
  return Type.encode(message).finish();
}

export function encodeMessageDelimited(root, typeName, data) {
  const Type = root.lookupType(typeName);
  const errMsg = Type.verify(data);
  if (errMsg) throw new ProtobufEncodingError(`${typeName} validation failed: ${errMsg}`);
  const message = Type.create(data);
  return Type.encodeDelimited(message).finish();
}
