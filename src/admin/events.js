import { EventEmitter } from "node:events";

const bus = new EventEmitter();
bus.setMaxListeners(50);

export function emitCaseCreated(caseDoc) {
  const plain =
    typeof caseDoc?.toObject === "function" ? caseDoc.toObject() : caseDoc;
  bus.emit("case_created", {
    ref: plain.ref,
    agencyLabel: plain.jurisdiction?.agencyLabel || null,
    agencyId: plain.jurisdiction?.agencyId || null,
    categoryLabel: plain.classification?.categoryLabel || null,
    status: plain.status,
    createdAt: plain.createdAt || new Date().toISOString(),
  });
}

export function subscribeCaseCreated(listener) {
  bus.on("case_created", listener);
  return () => bus.off("case_created", listener);
}
