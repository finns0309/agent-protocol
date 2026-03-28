import {
  assertObject,
  assertOneOf,
  assertOptionalNumber,
  assertOptionalObject,
  assertOptionalString,
  assertString,
  clone
} from "./utils.js";
import { createMessagePayload } from "./content.js";

export const MessageTypes = {
  ANNOUNCE: "ANNOUNCE",
  REQUEST: "REQUEST",
  OFFER: "OFFER",
  NEGOTIATE: "NEGOTIATE",
  ROUTE: "ROUTE",
  DELIVER: "DELIVER",
  CONFIRM: "CONFIRM",
  REACT: "REACT",
  SYSTEM: "SYSTEM"
};

const MESSAGE_TYPE_VALUES = new Set(Object.values(MessageTypes));

export function createEnvelope(spec) {
  assertObject(spec, "envelope");
  assertString(spec.id, "envelope.id");
  assertString(spec.from, "envelope.from");
  assertString(spec.channelId, "envelope.channelId");
  assertString(spec.type, "envelope.type");
  assertOneOf(spec.type, MESSAGE_TYPE_VALUES, "envelope.type");
  assertOptionalString(spec.to, "envelope.to");
  assertOptionalString(spec.subject, "envelope.subject");
  assertOptionalString(spec.replyTo, "envelope.replyTo");
  assertOptionalObject(spec.payload, "envelope.payload");
  assertOptionalObject(spec.metadata, "envelope.metadata");
  assertOptionalNumber(spec.timestamp, "envelope.timestamp");

  return clone({
    id: spec.id,
    from: spec.from,
    to: spec.to || "",
    channelId: spec.channelId,
    type: spec.type,
    subject: spec.subject || "",
    replyTo: spec.replyTo || "",
    payload: createMessagePayload(spec.payload || {}),
    metadata: spec.metadata || {},
    timestamp: spec.timestamp ?? Date.now()
  });
}
