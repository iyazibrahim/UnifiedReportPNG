import { AuditLog } from "../models/AuditLog.js";

/**
 * @param {object} entry
 * @param {string} entry.action
 * @param {import('mongoose').Types.ObjectId|string|null} [entry.actorUserId]
 * @param {string|null} [entry.actorUsername]
 * @param {string|null} [entry.targetType]
 * @param {string|null} [entry.targetId]
 * @param {object} [entry.meta]
 * @param {string|null} [entry.ip]
 */
export async function writeAudit(entry) {
  try {
    await AuditLog.create({
      action: entry.action,
      actorUserId: entry.actorUserId || null,
      actorUsername: entry.actorUsername || null,
      targetType: entry.targetType || null,
      targetId: entry.targetId || null,
      meta: entry.meta || {},
      ip: entry.ip || null,
    });
  } catch (err) {
    console.error("audit log failed:", err.message);
  }
}

export async function listAuditLogs({ limit = 100, skip = 0, action } = {}) {
  const filter = {};
  if (action) filter.action = String(action);
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(limit, 500))
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total };
}
