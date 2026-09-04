import { Router } from "express";
import { Case } from "../models/Case.js";
import { MockTicket } from "../models/MockTicket.js";
import {
  getPublicSettings,
  patchSettings,
} from "../settings/service.js";
import {
  loginAdmin,
  requireAdminAuth,
} from "./auth.js";
import { AGENCIES, CATEGORIES } from "../jurisdiction/categories.js";
import { fetchCasePhoto } from "./telegramMedia.js";
import { subscribeCaseCreated } from "./events.js";
import { checkLoginRateLimit, resetLoginRateLimit } from "../auth/rateLimit.js";
import { writeAudit, listAuditLogs } from "../audit/service.js";
import {
  getGovernance,
  patchGovernance,
  governanceReady,
} from "../governance/service.js";
import {
  listUsers,
  createUser,
  setUserDisabled,
  resetUserPassword,
} from "../auth/users.js";
import { cancelCaseIfReceived } from "../cases/cancel.js";
import { buildExternalRef } from "../adapters/mocks.js";
import { toDispatchPayload } from "../cases/payload.js";
import { getSlaHoursForAgency } from "../governance/service.js";
import { computeDueAt } from "../adapters/official.js";
import { resolveJurisdiction } from "../jurisdiction/resolver.js";
import {
  createAndIngestKnowledgeDoc,
  deactivateChunksForDoc,
  ingestCorrection,
} from "../ai/ingest.js";
import { KnowledgeDoc } from "../models/KnowledgeDoc.js";
import { KnowledgeChunk } from "../models/KnowledgeChunk.js";
import { Landmark } from "../models/Landmark.js";
import { invalidateLandmarkCache } from "../location/landmarkStore.js";

function ticketBucket(status) {
  if (status === "in_progress") return "in_progress";
  if (status === "resolved" || status === "rejected") return "closed";
  return "open";
}

export function createAdminRouter(config) {
  const router = Router();

  router.post("/login", async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const rate = checkLoginRateLimit(`admin-login:${ip}`);
    if (!rate.allowed) {
      return res.status(429).json({
        error: "Too many login attempts",
        retryAfterSec: rate.retryAfterSec,
      });
    }
    const { username, password } = req.body || {};
    const token = await loginAdmin(username, password, config);
    if (!token) {
      await writeAudit({
        action: "login_failed",
        actorUsername: username || null,
        meta: { portal: "admin" },
        ip,
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    resetLoginRateLimit(`admin-login:${ip}`);
    await writeAudit({
      action: "login_success",
      actorUsername: username,
      meta: { portal: "admin" },
      ip,
    });
    res.json({ token, user: { username } });
  });

  router.use(requireAdminAuth(config));

  router.get("/governance", async (_req, res) => {
    const governance = await getGovernance();
    res.json({
      governance,
      ready: governanceReady(governance),
      pendingOwnerConfirmation: !governanceReady(governance),
    });
  });

  router.patch("/governance", async (req, res) => {
    const governance = await patchGovernance(req.body || {}, {
      updatedBy: req.admin?.sub || "admin",
    });
    await writeAudit({
      action: "governance_update",
      actorUsername: req.admin?.sub,
      meta: { keys: Object.keys(req.body || {}) },
      ip: req.ip,
    });
    res.json({
      governance,
      ready: governanceReady(governance),
    });
  });

  router.get("/audit", async (req, res) => {
    const { limit, skip, action } = req.query;
    const data = await listAuditLogs({
      limit: Number(limit) || 100,
      skip: Number(skip) || 0,
      action: action ? String(action) : undefined,
    });
    res.json(data);
  });

  router.get("/users", async (_req, res) => {
    res.json({ items: await listUsers() });
  });

  router.post("/users", async (req, res) => {
    try {
      const user = await createUser(req.body || {});
      await writeAudit({
        action: "user_create",
        actorUsername: req.admin?.sub,
        targetType: "user",
        targetId: user.username,
        ip: req.ip,
      });
      res.status(201).json({ user });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch("/users/:id", async (req, res) => {
    const user = await setUserDisabled(req.params.id, req.body?.disabled);
    if (!user) return res.status(404).json({ error: "Not found" });
    await writeAudit({
      action: req.body?.disabled ? "user_disable" : "user_enable",
      actorUsername: req.admin?.sub,
      targetType: "user",
      targetId: user.username,
      ip: req.ip,
    });
    res.json({ user });
  });

  router.patch("/users/:id/password", async (req, res) => {
    if (req.admin?.role !== "super_admin") {
      return res.status(403).json({ error: "Super-admin only" });
    }
    try {
      const user = await resetUserPassword(
        req.params.id,
        req.body?.newPassword
      );
      await writeAudit({
        action: "password_reset_admin",
        actorUsername: req.admin?.sub,
        targetType: "user",
        targetId: user.username,
        ip: req.ip,
      });
      res.json({ ok: true, user: { username: user.username } });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 15000);

    const unsub = subscribeCaseCreated((payload) => {
      try {
        res.write(
          `event: case_created\ndata: ${JSON.stringify(payload)}\n\n`
        );
      } catch {
        /* client gone */
      }
    });

    req.on("close", () => {
      clearInterval(heartbeat);
      unsub();
    });
  });

  router.get("/stats", async (_req, res) => {
    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const visible = { hidden: { $ne: true } };

    const [
      total,
      byStatus,
      byAgency,
      byCategory,
      tickets,
      recent,
      thisMonthCases,
      lastMonthCases,
      thisMonthTickets,
      lastMonthTickets,
    ] = await Promise.all([
      Case.countDocuments(visible),
      Case.aggregate([
        { $match: visible },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Case.aggregate([
        { $match: visible },
        { $group: { _id: "$jurisdiction.agencyId", count: { $sum: 1 } } },
      ]),
      Case.aggregate([
        { $match: visible },
        {
          $group: {
            _id: "$classification.categoryId",
            count: { $sum: 1 },
          },
        },
      ]),
      MockTicket.find().select("status adapterId createdAt").lean(),
      Case.find(visible).sort({ createdAt: -1 }).limit(8).lean(),
      Case.countDocuments({ ...visible, createdAt: { $gte: startThisMonth } }),
      Case.countDocuments({
        ...visible,
        createdAt: { $gte: startLastMonth, $lt: startThisMonth },
      }),
      MockTicket.find({ createdAt: { $gte: startThisMonth } })
        .select("status")
        .lean(),
      MockTicket.find({
        createdAt: { $gte: startLastMonth, $lt: startThisMonth },
      })
        .select("status")
        .lean(),
    ]);

    function bucketTickets(list, caseCount) {
      const by = { open: 0, in_progress: 0, closed: 0 };
      for (const t of list) {
        by[ticketBucket(t.status)] += 1;
      }
      if (caseCount > list.length) {
        by.open += caseCount - list.length;
      }
      return by;
    }

    const byTicketStatus = bucketTickets(tickets, total);
    const thisMonthStatus = bucketTickets(thisMonthTickets, thisMonthCases);
    const lastMonthStatus = bucketTickets(lastMonthTickets, lastMonthCases);

    const byCategoryLabeled = {};
    for (const row of byCategory) {
      const id = row._id || "unknown";
      const label = CATEGORIES[id]?.label || id;
      byCategoryLabeled[label] = row.count;
    }

    res.json({
      total,
      byStatus: Object.fromEntries(
        byStatus.map((r) => [r._id || "unknown", r.count])
      ),
      byAgency: Object.fromEntries(
        byAgency.map((r) => [r._id || "unknown", r.count])
      ),
      byCategory: byCategoryLabeled,
      byTicketStatus,
      recent,
      agencies: AGENCIES,
      kpis: {
        total: thisMonthCases,
        open: thisMonthStatus.open,
        in_progress: thisMonthStatus.in_progress,
        closed: thisMonthStatus.closed,
      },
      vsLastMonth: {
        total: lastMonthCases,
        open: lastMonthStatus.open,
        in_progress: lastMonthStatus.in_progress,
        closed: lastMonthStatus.closed,
      },
    });
  });

  router.get("/cases", async (req, res) => {
    const {
      status,
      agency,
      q,
      limit = "50",
      skip = "0",
      includeHidden,
    } = req.query;
    const filter = {};
    if (includeHidden !== "true") filter.hidden = { $ne: true };
    if (status) filter.status = String(status);
    if (agency) filter["jurisdiction.agencyId"] = String(agency);
    if (q) {
      const term = String(q).trim();
      filter.$or = [
        { ref: new RegExp(term, "i") },
        { "intake.text": new RegExp(term, "i") },
        { "dispatch.externalRef": new RegExp(term, "i") },
      ];
    }
    const [items, total] = await Promise.all([
      Case.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(skip) || 0)
        .limit(Math.min(Number(limit) || 50, 200))
        .lean(),
      Case.countDocuments(filter),
    ]);
    res.json({ items, total });
  });

  router.get("/cases/:ref", async (req, res) => {
    const caseDoc = await Case.findOne({
      ref: String(req.params.ref).toUpperCase(),
      hidden: { $ne: true },
    }).lean();
    if (!caseDoc) return res.status(404).json({ error: "Not found" });
    const ticket = await MockTicket.findOne({ caseRef: caseDoc.ref }).lean();
    const linked =
      ticket ||
      (caseDoc.dispatch?.externalRef
        ? await MockTicket.findOne({
            externalRef: caseDoc.dispatch.externalRef,
          })
            .sort({ createdAt: -1 })
            .lean()
        : null);
    res.json({ case: caseDoc, ticket: linked });
  });

  router.patch("/cases/:ref/hide", async (req, res) => {
    const reason = String(req.body?.reason || "admin_hide");
    const caseDoc = await Case.findOneAndUpdate(
      { ref: String(req.params.ref).toUpperCase() },
      {
        hidden: true,
        hiddenAt: new Date(),
        hiddenBy: req.admin?.sub || "admin",
        hiddenReason: reason,
      },
      { new: true }
    ).lean();
    if (!caseDoc) return res.status(404).json({ error: "Not found" });
    await writeAudit({
      action: "case_hide",
      actorUsername: req.admin?.sub,
      targetType: "case",
      targetId: caseDoc.ref,
      meta: { reason },
      ip: req.ip,
    });
    res.json({ case: caseDoc });
  });

  router.post("/cases/:ref/cancel", async (req, res) => {
    const result = await cancelCaseIfReceived(req.params.ref, {
      actor: req.admin?.sub || "admin",
    });
    if (!result.ok) {
      return res.status(400).json(result);
    }
    await writeAudit({
      action: "case_cancel",
      actorUsername: req.admin?.sub,
      targetType: "case",
      targetId: result.case.ref,
      ip: req.ip,
    });
    res.json(result);
  });

  router.patch("/cases/:ref/reassign", async (req, res) => {
    const agencyId = String(req.body?.agencyId || "");
    const agency = AGENCIES[agencyId];
    if (!agency) {
      return res.status(400).json({ error: "Unknown agency" });
    }
    const caseDoc = await Case.findOne({
      ref: String(req.params.ref).toUpperCase(),
      hidden: { $ne: true },
    });
    if (!caseDoc) return res.status(404).json({ error: "Not found" });

    try {
      const oldTicket = await MockTicket.findOne({ caseRef: caseDoc.ref });
      if (oldTicket && oldTicket.adapterId !== agencyId) {
        oldTicket.status = "rejected";
        oldTicket.statusHistory = oldTicket.statusHistory || [];
        oldTicket.statusHistory.push({
          status: "rejected",
          note: `Ditugaskan semula ke ${agency.label}`,
          actorUsername: req.admin?.sub || "admin",
          at: new Date(),
        });
        await oldTicket.save();
      }

      const externalRef = buildExternalRef(agencyId, caseDoc.ref);
      const now = new Date();
      const slaHours = await getSlaHoursForAgency(agencyId);
      const payload = toDispatchPayload(caseDoc);

      let ticket = await MockTicket.findOne({
        caseRef: caseDoc.ref,
        adapterId: agencyId,
      });
      if (!ticket) {
        ticket = await MockTicket.create({
          adapterId: agencyId,
          externalRef,
          caseRef: caseDoc.ref,
          payload,
          status: "received",
          dueAt: computeDueAt(now, slaHours),
          statusHistory: [
            {
              status: "received",
              note: "Ditugaskan semula oleh admin",
              actorUsername: req.admin?.sub || "admin",
              at: now,
            },
          ],
        });
      }

      caseDoc.jurisdiction = {
        ...caseDoc.jurisdiction,
        agencyId,
        agencyLabel: agency.label,
        reason: `Ditugaskan semula oleh admin (${req.admin?.sub})`,
      };
      caseDoc.dispatch = {
        adapterId: agencyId,
        status: "dispatched",
        externalRef: ticket.externalRef,
        dispatchedAt: now.toISOString(),
        requestPayload: payload,
      };
      caseDoc.status = caseDoc.jurisdiction?.needsTriage
        ? "triaged"
        : "dispatched";
      await caseDoc.save();
      try {
        await ingestCorrection({
          caseRef: caseDoc.ref,
          text: caseDoc.intake?.text,
          categoryId: caseDoc.classification?.categoryId,
          agencyId,
          daerah: caseDoc.location?.daerah,
          note: `Admin reassigned to ${agency.label}`,
        });
      } catch {
        // non-fatal
      }
      await writeAudit({
        action: "case_reassign",
        actorUsername: req.admin?.sub,
        targetType: "case",
        targetId: caseDoc.ref,
        meta: { agencyId, externalRef: ticket.externalRef },
        ip: req.ip,
      });
      res.json({ case: caseDoc.toObject(), ticket: ticket.toObject() });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch("/cases/:ref/classification", async (req, res) => {
    const categoryId = String(req.body?.categoryId || "");
    const category = CATEGORIES[categoryId];
    if (!category) {
      return res.status(400).json({ error: "Unknown category" });
    }
    const caseDoc = await Case.findOne({
      ref: String(req.params.ref).toUpperCase(),
      hidden: { $ne: true },
    });
    if (!caseDoc) return res.status(404).json({ error: "Not found" });

    const prevCategory = caseDoc.classification?.categoryId;
    const loc = caseDoc.location || {};
    caseDoc.classification = {
      ...(caseDoc.classification || {}),
      categoryId: category.id,
      categoryLabel: category.label,
      confidence: 1,
      method: "admin_correction",
      correctedFrom: prevCategory || null,
      correctedBy: req.admin?.sub || "admin",
    };
    const jurisdiction = resolveJurisdiction({
      categoryId: category.id,
      lat: loc.lat,
      lng: loc.lng,
      label: {
        display_name: loc.display_name,
        road: loc.road,
      },
    });
    caseDoc.jurisdiction = {
      ...jurisdiction,
      reason: `Kategori dibetulkan oleh admin (${req.admin?.sub}) · ${jurisdiction.reason}`,
    };
    await caseDoc.save();
    try {
      await ingestCorrection({
        caseRef: caseDoc.ref,
        text: caseDoc.intake?.text,
        categoryId: category.id,
        agencyId: caseDoc.jurisdiction?.agencyId,
        daerah: loc.daerah,
        note: `Admin corrected category from ${prevCategory} to ${category.id}`,
      });
    } catch {
      // non-fatal
    }
    await writeAudit({
      action: "case_classification_fix",
      actorUsername: req.admin?.sub,
      targetType: "case",
      targetId: caseDoc.ref,
      meta: { categoryId, prevCategory },
      ip: req.ip,
    });
    res.json({ case: caseDoc.toObject() });
  });

  router.get("/knowledge", async (_req, res) => {
    const docs = await KnowledgeDoc.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const chunkCount = await KnowledgeChunk.countDocuments({
      active: { $ne: false },
    });
    res.json({ docs, chunkCount });
  });

  router.post("/knowledge", async (req, res) => {
    try {
      const { title, body, agencyId, docType } = req.body || {};
      if (!body || !String(body).trim()) {
        return res.status(400).json({ error: "body required" });
      }
      const result = await createAndIngestKnowledgeDoc({
        title: title || "Untitled",
        body: String(body),
        agencyId: agencyId || null,
        docType: docType || "sop",
        createdBy: req.admin?.sub || "admin",
      });
      await writeAudit({
        action: "knowledge_create",
        actorUsername: req.admin?.sub,
        targetType: "knowledge",
        targetId: String(result.doc._id),
        meta: { chunks: result.chunks.length },
        ip: req.ip,
      });
      res.json({
        doc: result.doc.toObject(),
        chunkCount: result.chunks.length,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete("/knowledge/:id", async (req, res) => {
    const doc = await KnowledgeDoc.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    doc.active = false;
    await doc.save();
    await deactivateChunksForDoc(doc._id);
    await writeAudit({
      action: "knowledge_deactivate",
      actorUsername: req.admin?.sub,
      targetType: "knowledge",
      targetId: String(doc._id),
      ip: req.ip,
    });
    res.json({ ok: true });
  });

  router.get("/landmarks", async (req, res) => {
    const q = String(req.query.q || "").trim();
    const filter = {};
    if (q) {
      filter.$or = [
        { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        { aliases: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      ];
    }
    if (req.query.source) filter.source = String(req.query.source);
    const items = await Landmark.find(filter)
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    res.json({ items });
  });

  router.patch("/landmarks/:id", async (req, res) => {
    const lm = await Landmark.findById(req.params.id);
    if (!lm) return res.status(404).json({ error: "Not found" });
    if (req.body?.disabled !== undefined) {
      lm.disabled = Boolean(req.body.disabled);
    }
    if (typeof req.body?.alias === "string" && req.body.alias.trim()) {
      const alias = req.body.alias.trim().slice(0, 120);
      if (!lm.aliases.some((a) => a.toLowerCase() === alias.toLowerCase())) {
        lm.aliases = [...(lm.aliases || []), alias];
      }
    }
    await lm.save();
    invalidateLandmarkCache();
    res.json({ landmark: lm.toObject() });
  });

  router.get("/cases/:ref/photos/:fileId", async (req, res) => {
    try {
      const caseDoc = await Case.findOne({
        ref: String(req.params.ref).toUpperCase(),
        hidden: { $ne: true },
      }).lean();
      if (!caseDoc) return res.status(404).json({ error: "Not found" });
      const fileId = decodeURIComponent(String(req.params.fileId));
      const allowed = caseDoc.intake?.photoFileIds || [];
      if (!allowed.includes(fileId)) {
        return res.status(403).json({ error: "Photo not on this case" });
      }
      const { buffer, contentType } = await fetchCasePhoto(fileId);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(buffer);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get("/settings", async (_req, res) => {
    res.json(await getPublicSettings());
  });

  router.patch("/settings", async (req, res) => {
    try {
      const updated = await patchSettings(req.body || {}, {
        updatedBy: req.admin?.sub || "admin",
      });
      await writeAudit({
        action: "settings_update",
        actorUsername: req.admin?.sub,
        meta: {
          toggles: Object.keys(req.body?.toggles || {}),
          config: Object.keys(req.body?.config || {}),
          secrets: Object.keys(req.body?.secrets || {}),
        },
        ip: req.ip,
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/mock-tickets", async (req, res) => {
    const filter = {};
    if (req.query.agencyId) filter.adapterId = String(req.query.agencyId);
    if (req.query.status) filter.status = String(req.query.status);
    const items = await MockTicket.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ items });
  });

  return router;
}

export { ticketBucket };
