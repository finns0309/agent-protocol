export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertOneOf(value, allowedValues, label) {
  const allowed = Array.from(allowedValues || []);
  assert(allowed.includes(value), `${label} must be one of: ${allowed.join(", ")}.`);
}

export function assertString(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} must be a non-empty string.`);
}

export function assertOptionalString(value, label) {
  assert(value == null || typeof value === "string", `${label} must be a string when provided.`);
}

export function assertArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array.`);
}

export function assertObject(value, label) {
  assert(isPlainObject(value), `${label} must be an object.`);
}

export function assertOptionalObject(value, label) {
  assert(value == null || isPlainObject(value), `${label} must be an object when provided.`);
}

export function assertOptionalNumber(value, label) {
  assert(value == null || (typeof value === "number" && Number.isFinite(value)), `${label} must be a finite number when provided.`);
}
