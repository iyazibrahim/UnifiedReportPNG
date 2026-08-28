import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { AGENCIES } from "../jurisdiction/categories.js";
import {
  MockTicket,
  MOCK_TICKET_STATUSES,
  STATUS_LABEL,
  allowedNextStatuses,
} from "../models/MockTicket.js";
import { Case } from "../models/Case.js";
import {
  loginAdmin,
  requireAgencyAuth,
  assertAgencyAccess,
} from "../admin/auth.js";
import { notifyReporterStatusUpdate } from "../notify/telegram.js";
import { writeAudit } from "../audit/service.js";
import { checkLoginRateLimit, resetLoginRateLimit } from "../auth/rateLimit.js";
import { fetchCasePhoto } from "../admin/telegramMedia.js";
import { getSlaHoursForAgency } from "../governance/service.js";
import { computeDueAt } from "../adapters/official.js";

function agencyMiddleware(req, res, next) {
  const agencyId = String(req.params.agencyId || "");
  if (!AGENCIES[agencyId]) {
    return res.status(404).json({ error: "Unknown agency" });
  }
  req.agencyId = agencyId;
  next();
}

function agencyAccessGuard(req, res, next) {
  if (!assertAgencyAccess(req.user, req.agencyId)) {
    return res.status(403).json({ error: "Forbidden for this agency" });
  }
  next();
}

/**
 * @param {{ config: object, senders?: object }} opts
 */
export function createAgencyRouter({ config, senders = {} } = {}) {
  const router = Router({ mergeParams: true });

  router.post("/login", async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const rate = checkLoginRateLimit(`agency-login:${ip}`);
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
        meta: { portal: "agency" },
        ip,
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    resetLoginRateLimit(`agency-login:${ip}`);
    res.json({ token, user: { username } });
  });

  router.get("/agencies", (_req, res) => {
    res.json({
      agencies: Object.values(AGENCIES).map((a) => ({
        ...a,
        portalPath: `/portals/${a.id}`,
      })),
    });
  });

  router.use("/:agencyId", requireAgencyAuth(config), agencyMiddleware, agencyAccessGuard);

  router.get("/:agencyId/meta", (req, res) => {
    res.json({
      agency: AGENCIES[req.agencyId],
      statuses: MOCK_TICKET_STATUSES.map((s) => ({
        id: s,
        label: STATUS_LABEL[s],
      })),
    });
  });

  router.get("/:agencyId/stats", async (req, res) => {
    const items = await MockTicket.find({ adapterId: req.agencyId }).lean();
    const counts = {
      received: 0,
      acknowledged: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
    };
    const now = Date.now();
    let overdue = 0;
    for (const t of items) {
      if (counts[t.status] !== undefined) counts[t.status] += 1;
      if (
        t.dueAt &&
        !["resolved", "rejected"].includes(t.status) &&
        new Date(t.dueAt).getTime() < now
      ) {
        overdue += 1;
      }
    }
    res.json({
      agency: AGENCIES[req.agencyId],
      counts,
      total: items.length,
      overdue,
    });
  });

  router.get("/:agencyId/tickets", async (req, res) => {
    const filter = { adapterId: req.agencyId };
    if (req.query.status) filter.status = String(req.query.status);
    const items = await MockTicket.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const now = Date.now();
    const enriched = items.map((t) => ({
      ...t,
      sla: t.dueAt
        ? {
            dueAt: t.dueAt,
            overdue:
              !["resolved", "rejected"].includes(t.status) &&
              new Date(t.dueAt).getTime() < now,
          }
        : null,
    }));
    res.json({
      agency: AGENCIES[req.agencyId],
      items: enriched,
    });
  });

  router.get("/:agencyId/tickets/:externalRef", async (req, res) => {
    const ref = String(req.params.externalRef);
    const ticket =
      (await MockTicket.findOne({
        adapterId: req.agencyId,
        externalRef: ref.toUpperCase(),
      }).lean()) ||
      (await MockTicket.findOne({
        adapterId: req.agencyId,
        externalRef: ref,
      }).lean());
    if (!ticket) return res.status(404).json({ error: "Not found" });

    let caseDoc = null;
    if (ticket.caseRef) {
      caseDoc = await Case.findOne({
        ref: ticket.caseRef,
        hidden: { $ne: true },
      }).lean();
    }
    res.json({
      agency: AGENCIES[req.agencyId],
      ticket,
      case: caseDoc,
    });
  });

  router.get(
    "/:agencyId/tickets/:externalRef/photos/:fileId",
    async (req, res) => {
      try {
        const ticket = await MockTicket.findOne({
          adapterId: req.agencyId,
          externalRef: String(req.params.externalRef),
        }).lean();
        if (!ticket?.caseRef) {
          return res.status(404).json({ error: "Not found" });
        }
        const caseDoc = await Case.findOne({ ref: ticket.caseRef }).lean();
        if (!caseDoc) return res.status(404).json({ error: "Not found" });
        const fileId = decodeURIComponent(String(req.params.fileId));
        const allowed = caseDoc.intake?.photoFileIds || [];
        if (!allowed.includes(fileId)) {
          return res.status(403).json({ error: "Photo not on this case" });
        }
        if (fileId.startsWith("local:")) {
          const filename = path.basename(fileId.slice(6));
          const filePath = path.join(
            process.cwd(),
            "data",
            "media",
            filename
          );
          const buffer = await fs.readFile(filePath);
          res.setHeader("Content-Type", "image/jpeg");
          res.setHeader("Cache-Control", "private, max-age=3600");
          return res.send(buffer);
        }
        const { buffer, contentType } = await fetchCasePhoto(fileId);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.send(buffer);
      } catch (err) {
        res.status(502).json({ error: err.message });
      }
    }
  );

  router.patch("/:agencyId/tickets/:externalRef/status", async (req, res) => {
    const status = String(req.body?.status || "");
    if (!MOCK_TICKET_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const ticket = await MockTicket.findOne({
      adapterId: req.agencyId,
      externalRef: String(req.params.externalRef),
    });
    if (!ticket) {
      return res.status(404).json({ error: "Not found" });
    }
    const allowed = allowedNextStatuses(ticket.status);
    if (ticket.status !== status && !allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot move from ${ticket.status} to ${status}`,
        allowed,
      });
    }
    ticket.status = status;
    ticket.statusHistory = ticket.statusHistory || [];
    ticket.statusHistory.push({
      status,
      note: req.body?.note ? String(req.body.note) : STATUS_LABEL[status],
      actorUserId: req.user?.uid || null,
      actorUsername: req.user?.sub || null,
      at: new Date(),
    });
    if (req.body?.assignedUnit != null) {
      ticket.assignedUnit = String(req.body.assignedUnit);
    }
    if (!ticket.dueAt) {
      const hours = await getSlaHoursForAgency(req.agencyId);
      ticket.dueAt = computeDueAt(ticket.createdAt || new Date(), hours);
    }
    await ticket.save();

    const ticketObj = ticket.toObject();
    if (ticket.caseRef) {
      const caseDoc = await Case.findOne({ ref: ticket.caseRef }).lean();
      if (caseDoc) {
        await notifyReporterStatusUpdate(senders, caseDoc, ticketObj);
      }
    }

    await writeAudit({
      action: "ticket_status_change",
      actorUserId: req.user?.uid || null,
      actorUsername: req.user?.sub || null,
      targetType: "ticket",
      targetId: ticket.externalRef,
      meta: { status, agencyId: req.agencyId },
      ip: req.ip,
    });

    res.json({ agency: AGENCIES[req.agencyId], ticket: ticketObj });
  });

  return router;
}

export { STATUS_LABEL };
