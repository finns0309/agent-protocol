import { assertObject, assertOptionalObject, assertOptionalString, assertString, clone } from "./utils.js";

export function createObligation(spec) {
  assertObject(spec, "obligation");
  assertString(spec.id, "obligation.id");
  assertString(spec.type, "obligation.type");
  assertString(spec.issuer, "obligation.issuer");
  assertString(spec.holder, "obligation.holder");
  assertOptionalString(spec.status, "obligation.status");
  assertOptionalString(spec.settlementRule, "obligation.settlementRule");
  assertOptionalString(spec.failureConsequence, "obligation.failureConsequence");
  assertOptionalObject(spec.data, "obligation.data");

  return clone({
    id: spec.id,
    type: spec.type,
    issuer: spec.issuer,
    holder: spec.holder,
    status: spec.status || "active",
    settlementRule: spec.settlementRule || "",
    failureConsequence: spec.failureConsequence || "",
    dueAt: spec.dueAt ?? null,
    data: spec.data || {}
  });
}

export function settleObligation(obligation, patch = {}) {
  return createObligation({
    ...obligation,
    ...patch,
    status: patch.status || "settled"
  });
}

export function isOverdue(obligation, now = Date.now()) {
  return Boolean(obligation?.dueAt) && obligation.status === "active" && obligation.dueAt < now;
}
