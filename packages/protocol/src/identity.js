import { assertObject, assertOptionalObject, assertOptionalString, assertString, clone } from "./utils.js";

export function createIdentity(spec) {
  assertObject(spec, "identity");
  assertString(spec.id, "identity.id");
  assertString(spec.displayName, "identity.displayName");
  assertOptionalString(spec.role, "identity.role");
  assertOptionalString(spec.directive, "identity.directive");
  assertOptionalString(spec.origin, "identity.origin");
  assertOptionalString(spec.model, "identity.model");
  assertOptionalString(spec.version, "identity.version");
  assertOptionalString(spec.issuer, "identity.issuer");
  assertOptionalString(spec.signature, "identity.signature");
  assertOptionalObject(spec.metadata, "identity.metadata");

  return clone({
    id: spec.id,
    displayName: spec.displayName,
    role: spec.role || "",
    directive: spec.directive || "",
    origin: spec.origin || "",
    model: spec.model || "",
    version: spec.version || "",
    issuer: spec.issuer || "",
    signature: spec.signature || "",
    metadata: spec.metadata || {}
  });
}

export function verifyIdentity(identity) {
  createIdentity(identity);
  return true;
}
