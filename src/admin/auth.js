import crypto from "node:crypto";
import mongoose from "mongoose";
import { authenticateUser, userToClaims } from "../auth/users.js";
import { verifyPassword } from "../auth/password.js";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function createToken(claims, secret, expiresInSec = 60 * 60 * 12) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({
      ...claims,
      exp: Math.floor(Date.now() / 1000) + expiresInSec,
    })
  );
  const sig = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token, secret) {
  if (!token || !secret) return null;
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = sign(`${header}.${body}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const json = JSON.parse(
      Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    );
    if (json.exp && json.exp < Math.floor(Date.now() / 1000)) return null;
    return json;
  } catch {
    return null;
  }
}

const ADMIN_ROLES = new Set(["super_admin", "admin"]);
const AGENCY_ROLES = new Set(["agency_admin", "agency_operator"]);

export async function loginAdmin(username, password, config) {
  if (mongoose.connection.readyState === 1) {
    const user = await authenticateUser(username, password);
    if (user) {
      return createToken(userToClaims(user), config.jwtSecret);
    }
  }
  if (username === config.opsUser) {
    const envPass = config.opsPassword || "";
    const ok =
      password === envPass ||
      (envPass && (await verifyPassword(password, envPass)));
    if (ok) {
      return createToken(
        { sub: username, role: "super_admin", agencyId: null },
        config.jwtSecret
      );
    }
  }
  return null;
}

function extractToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, bearer] = header.split(" ");
  if (scheme === "Bearer" && bearer) return bearer;
  if (req.query.access_token) return String(req.query.access_token);
  return null;
}

export function requireAuth(config, { roles } = {}) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const claims = verifyToken(token, config.jwtSecret);
    if (!claims?.sub) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (roles?.length && !roles.includes(claims.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.user = claims;
    req.admin = claims;
    next();
  };
}

export function requireAdminAuth(config) {
  return requireAuth(config, {
    roles: [...ADMIN_ROLES],
  });
}

export function requireAgencyAuth(config) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const claims = verifyToken(token, config.jwtSecret);
    if (!claims?.sub) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const isAdmin = ADMIN_ROLES.has(claims.role);
    const isAgency = AGENCY_ROLES.has(claims.role);
    if (!isAdmin && !isAgency) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.user = claims;
    req.admin = claims;
    next();
  };
}

export function assertAgencyAccess(claims, agencyId) {
  if (ADMIN_ROLES.has(claims.role)) return true;
  if (AGENCY_ROLES.has(claims.role) && claims.agencyId === agencyId) {
    return true;
  }
  return false;
}

export function isAdminRole(role) {
  return ADMIN_ROLES.has(role);
}
