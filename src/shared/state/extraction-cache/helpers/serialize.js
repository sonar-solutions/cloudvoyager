// -------- Serialization Helpers --------

/**
 * Convert data to a JSON-serializable form.
 * Handles Map objects by converting to arrays of entries.
 * @param {*} data
 * @returns {*}
 */
export function toSerializable(data) {
  if (data instanceof Map) {
    return { __type: 'Map', entries: [...data.entries()].map(([k, v]) => [k, toSerializable(v)]) };
  }
  if (Array.isArray(data)) {
    return data.map(item => toSerializable(item));
  }
  if (data && typeof data === 'object' && data.constructor === Object) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = toSerializable(value);
    }
    return result;
  }
  return data;
}

/**
 * Convert serialized data back to its original form.
 * Reconstructs Map objects from entries arrays.
 * @param {*} data
 * @returns {*}
 */
export function fromSerializable(data) {
  if (data && typeof data === 'object' && data.__type === 'Map') {
    return new Map(data.entries.map(([k, v]) => [k, fromSerializable(v)]));
  }
  if (Array.isArray(data)) {
    return data.map(item => fromSerializable(item));
  }
  if (data && typeof data === 'object' && data.constructor === Object) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = fromSerializable(value);
    }
    return result;
  }
  return data;
}
