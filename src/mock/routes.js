import { Router } from "express";
import { AGENCIES } from "../jurisdiction/categories.js";
import {
  MockTicket,
  MOCK_TICKET_STATUSES,
} from "../models/MockTicket.js";
import { resolveConfig } from "../settings/service.js";

const STATUS_LABEL = {
  received: "Diterima",
  in_progress: "Dalam tindakan",
  resolved: "Selesai",
  rejected: "Ditolak",
};

function agencyMiddleware(req, res, next) {
  const agencyId = String(req.params.agencyId || "");
  if (!AGENCIES[agencyId]) {
    return res.status(404).json({ error: "Unknown agency" });
  }
  req.agencyId = agencyId;
  next();
}

async function optionalPinGuard(req, res, next) {
  const pinCfg = await resolveConfig("mockPortalPin");
  if (!pinCfg.value) return next();
  const provided =
    req.headers["x-mock-pin"] ||
    req.query.pin ||
    req.body?.pin;
  if (String(provided) !== String(pinCfg.value)) {
    return res.status(401).json({ error: "PIN required", pinRequired: true });
  }
  next();
}

export function createMockRouter() {
  const router = Router({ mergeParams: true });

  router.get("/agencies", (_req, res) => {
    res.json({
      agencies: Object.values(AGENCIES).map((a) => ({
        ...a,
        portalPath: `/mock/${a.id}`,
      })),
    });
  });

  router.use("/:agencyId", agencyMiddleware);

  router.get("/:agencyId/meta", (req, res) => {
    res.json({
      agency: AGENCIES[req.agencyId],
      statuses: MOCK_TICKET_STATUSES.map((s) => ({
        id: s,
        label: STATUS_LABEL[s],
      })),
    });
  });

  router.get(
    "/:agencyId/tickets",
    optionalPinGuard,
    async (req, res) => {
      const filter = { adapterId: req.agencyId };
      if (req.query.status) filter.status = String(req.query.status);
      const items = await MockTicket.find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      res.json({
        agency: AGENCIES[req.agencyId],
        items,
      });
    }
  );

  router.get(
    "/:agencyId/tickets/:externalRef",
    optionalPinGuard,
    async (req, res) => {
      const ticket = await MockTicket.findOne({
        adapterId: req.agencyId,
        externalRef: String(req.params.externalRef).toUpperCase(),
      }).lean();
      if (!ticket) {
        const loose = await MockTicket.findOne({
          adapterId: req.agencyId,
          externalRef: String(req.params.externalRef),
        }).lean();
        if (!loose) return res.status(404).json({ error: "Not found" });
        return res.json({ agency: AGENCIES[req.agencyId], ticket: loose });
      }
      res.json({ agency: AGENCIES[req.agencyId], ticket });
    }
  );

  router.patch(
    "/:agencyId/tickets/:externalRef/status",
    optionalPinGuard,
    async (req, res) => {
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
      ticket.status = status;
      ticket.statusHistory = ticket.statusHistory || [];
      ticket.statusHistory.push({
        status,
        note: req.body?.note ? String(req.body.note) : STATUS_LABEL[status],
        at: new Date(),
      });
      if (req.body?.assignedUnit != null) {
        ticket.assignedUnit = String(req.body.assignedUnit);
      }
      await ticket.save();
      res.json({ agency: AGENCIES[req.agencyId], ticket: ticket.toObject() });
    }
  );

  return router;
}

export { STATUS_LABEL };
