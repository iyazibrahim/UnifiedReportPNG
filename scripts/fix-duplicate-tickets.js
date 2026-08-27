/**
 * One-off cleanup: untangle reused mock ticket IDs (e.g. PEARL-0001).
 *
 * Preview:
 *   node scripts/fix-duplicate-tickets.js --dry-run
 *
 * Apply (local app + Mongo):
 *   node scripts/fix-duplicate-tickets.js
 *
 * Apply (Docker stack):
 *   docker compose exec app node scripts/fix-duplicate-tickets.js
 */
import { loadConfig } from "../src/config.js";
import { connectDb } from "../src/db.js";
import { Case } from "../src/models/Case.js";
import { MockTicket } from "../src/models/MockTicket.js";
import { buildExternalRef } from "../src/adapters/mocks.js";

const dryRun = process.argv.includes("--dry-run");

async function ensureFreeExternalRef(desiredRef, keepId) {
  const clash = await MockTicket.findOne({
    externalRef: desiredRef,
    ...(keepId ? { _id: { $ne: keepId } } : {}),
  });
  if (clash) {
    await MockTicket.updateOne(
      { _id: clash._id },
      { $set: { externalRef: `${desiredRef}-OLD-${Date.now()}` } }
    );
  }
}

async function main() {
  const config = loadConfig();
  await connectDb(config.mongoUri);

  const cases = await Case.find({ "dispatch.externalRef": { $exists: true, $ne: null } })
    .sort({ createdAt: 1 })
    .lean();
  const tickets = await MockTicket.find().sort({ createdAt: 1 }).lean();
  const byCaseRef = new Map(
    tickets.filter((t) => t.caseRef).map((t) => [t.caseRef, t])
  );
  const claimedTicketIds = new Set();
  const report = [];

  for (const c of cases) {
    const agencyId =
      c.dispatch?.adapterId || c.jurisdiction?.agencyId || "pearl_mbpp";
    const desiredRef = buildExternalRef(agencyId, c.ref);
    let ticket = byCaseRef.get(c.ref);

    if (ticket && claimedTicketIds.has(String(ticket._id))) {
      ticket = null;
    }

    if (!ticket) {
      const oldRef = c.dispatch?.externalRef;
      ticket = tickets.find(
        (t) =>
          t.externalRef === oldRef &&
          !claimedTicketIds.has(String(t._id)) &&
          (!t.caseRef || t.caseRef === c.ref)
      );
    }

    if (ticket) {
      claimedTicketIds.add(String(ticket._id));
      report.push({
        action: "relink",
        caseRef: c.ref,
        from: ticket.externalRef,
        to: desiredRef,
        status: ticket.status,
      });
      if (!dryRun) {
        await ensureFreeExternalRef(desiredRef, ticket._id);
        await MockTicket.updateOne(
          { _id: ticket._id },
          { $set: { externalRef: desiredRef, caseRef: c.ref } }
        );
        await Case.updateOne(
          { _id: c._id },
          {
            $set: {
              "dispatch.externalRef": desiredRef,
              "dispatch.adapterId": agencyId,
            },
          }
        );
      }
    } else {
      report.push({
        action: "create",
        caseRef: c.ref,
        from: c.dispatch?.externalRef,
        to: desiredRef,
        status: "received",
      });
      if (!dryRun) {
        await ensureFreeExternalRef(desiredRef, null);
        await MockTicket.create({
          adapterId: agencyId,
          externalRef: desiredRef,
          caseRef: c.ref,
          payload: {
            intake: c.intake,
            location: c.location,
            classification: c.classification,
            jurisdiction: c.jurisdiction,
          },
          status: "received",
          statusHistory: [
            {
              status: "received",
              note: "Diterima semula selepas pembetulan ID tiket",
              at: new Date(),
            },
          ],
        });
        await Case.updateOne(
          { _id: c._id },
          {
            $set: {
              "dispatch.externalRef": desiredRef,
              "dispatch.adapterId": agencyId,
            },
          }
        );
      }
    }
  }

  const keepRefs = new Set(cases.map((c) => c.ref));
  const orphanQuery = {
    $or: [
      { caseRef: { $nin: [...keepRefs] } },
      { caseRef: null },
      { caseRef: { $exists: false } },
      { externalRef: /OLD-/ },
    ],
  };
  const orphans = await MockTicket.find(orphanQuery).lean();
  for (const t of orphans) {
    // Don't delete a ticket we just linked to a kept case
    if (t.caseRef && keepRefs.has(t.caseRef) && !/OLD-/.test(t.externalRef)) {
      continue;
    }
    report.push({
      action: dryRun ? "would_delete_orphan" : "delete_orphan",
      externalRef: t.externalRef,
      caseRef: t.caseRef || null,
    });
    if (!dryRun) {
      await MockTicket.deleteOne({ _id: t._id });
    }
  }

  console.log(dryRun ? "DRY RUN — no writes" : "Applied cleanup");
  console.log(JSON.stringify(report, null, 2));
  console.log(`Done. ${report.length} change(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
