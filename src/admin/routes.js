import { Router } from "express";
import { Case } from "../models/Case.js";
import { MockTicket } from "../models/MockTicket.js";
import {
  getPublicSettings,
  patchSettings,
} from "../settings/service.js";
import { loginAdmin, requireAdminAuth } from "./auth.js";
import { AGENCIES, CATEGORIES } from "../jurisdiction/categories.js";
import { fetchTelegramFile } from "./telegramMedia.js";
import { subscribeCaseCreated } from "./events.js";

function ticketBucket(status) {
  if (status === "in_progress") return "in_progress";
  if (status === "resolved" || status === "rejected") return "closed";
  return "open";
}

export function createAdminRouter(config) {
  const router = Router();

  router.post("/login", (req, res) => {
    const { username, password } = req.body || {};
    const token = loginAdmin(username, password, config);
    if (!token) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ token, user: { username } });
  });

  router.use(requireAdminAuth(config));

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
      Case.countDocuments(),
      Case.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Case.aggregate([
        { $group: { _id: "$jurisdiction.agencyId", count: { $sum: 1 } } },
      ]),
      Case.aggregate([
        {
          $group: {
            _id: "$classification.categoryId",
            count: { $sum: 1 },
          },
        },
      ]),
      MockTicket.find().select("status adapterId createdAt").lean(),
      Case.find().sort({ createdAt: -1 }).limit(8).lean(),
      Case.countDocuments({ createdAt: { $gte: startThisMonth } }),
      Case.countDocuments({
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
      // Month-over-month for Stat Cards (current month vs previous)
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
    } = req.query;
    const filter = {};
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
    }).lean();
    if (!caseDoc) return res.status(404).json({ error: "Not found" });
    const ticket = await MockTicket.findOne({ caseRef: caseDoc.ref }).lean();
    // Fallback for older tickets that may not have caseRef indexed the same way
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

  router.get("/cases/:ref/photos/:fileId", async (req, res) => {
    try {
      const caseDoc = await Case.findOne({
        ref: String(req.params.ref).toUpperCase(),
      }).lean();
      if (!caseDoc) return res.status(404).json({ error: "Not found" });
      const fileId = decodeURIComponent(String(req.params.fileId));
      const allowed = caseDoc.intake?.photoFileIds || [];
      if (!allowed.includes(fileId)) {
        return res.status(403).json({ error: "Photo not on this case" });
      }
      const { buffer, contentType } = await fetchTelegramFile(fileId);
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
