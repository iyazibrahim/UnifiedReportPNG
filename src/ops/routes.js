import { Router } from "express";
import { Case } from "../models/Case.js";
import { basicAuth, renderOpsPage } from "./page.js";

export function createOpsRouter(config) {
  const router = Router();
  router.use(basicAuth(config.opsUser, config.opsPassword));
  router.get("/", async (_req, res) => {
    const cases = await Case.find().sort({ createdAt: -1 }).limit(100).lean();
    res.type("html").send(renderOpsPage(cases));
  });
  return router;
}
