import { Router } from "express";
import { Case } from "../models/Case.js";
import { MockTicket } from "../models/MockTicket.js";
import {
  getPublicSettings,
  patchSettings,
} from "../settings/service.js";
import { loginAdmin, requireAdminAuth } from "./auth.js";
import { AGENCIES } from "../jurisdiction/categories.js";

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

  router.get("/stats", async (_req, res) => {
    const [total, byStatus, byAgency, recent] = await Promise.all([
      Case.countDocuments(),
      Case.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Case.aggregate([
        {
          $group: {
            _id: "$jurisdiction.agencyId",
            count: { $sum: 1 },
          },
        },
      ]),
      Case.find().sort({ createdAt: -1 }).limit(8).lean(),
    ]);
    res.json({
      total,
      byStatus: Object.fromEntries(byStatus.map((r) => [r._id || "unknown", r.count])),
      byAgency: Object.fromEntries(
        byAgency.map((r) => [r._id || "unknown", r.count])
      ),
      recent,
      agencies: AGENCIES,
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
    const ticket = caseDoc.dispatch?.externalRef
      ? await MockTicket.findOne({
          externalRef: caseDoc.dispatch.externalRef,
        }).lean()
      : null;
    res.json({ case: caseDoc, ticket });
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
