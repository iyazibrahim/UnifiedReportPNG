import { User } from "../models/User.js";
import { hashPassword, verifyPassword } from "./password.js";
import { AGENCIES } from "../jurisdiction/categories.js";

export async function ensureUsersSeeded(config) {
  const count = await User.countDocuments();
  if (count > 0) return;

  const opsHash = await hashPassword(config.opsPassword);
  await User.create({
    username: config.opsUser || "ops",
    passwordHash: opsHash,
    role: "super_admin",
    displayName: "Operations",
  });

  for (const agencyId of Object.keys(AGENCIES)) {
    const username = `${agencyId}_ops`;
    await User.create({
      username,
      passwordHash: await hashPassword("changeme"),
      role: "agency_operator",
      agencyId,
      displayName: `${AGENCIES[agencyId].short} operator`,
    });
  }
}

export async function authenticateUser(username, password) {
  const user = await User.findOne({
    username: String(username).trim(),
    disabled: { $ne: true },
  });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export function userToClaims(user) {
  return {
    sub: user.username,
    role: user.role,
    agencyId: user.agencyId || null,
    uid: String(user._id),
  };
}

export async function listUsers() {
  return User.find()
    .select("-passwordHash")
    .sort({ username: 1 })
    .lean();
}

export async function createUser({
  username,
  password,
  role,
  agencyId,
  displayName,
}) {
  const existing = await User.findOne({ username });
  if (existing) throw new Error("Username already exists");
  if (
    (role === "agency_operator" || role === "agency_admin") &&
    !agencyId
  ) {
    throw new Error("Agency users require agencyId");
  }
  return User.create({
    username,
    passwordHash: await hashPassword(password),
    role,
    agencyId: agencyId || null,
    displayName: displayName || username,
  });
}

export async function setUserDisabled(userId, disabled) {
  return User.findByIdAndUpdate(
    userId,
    { disabled: Boolean(disabled) },
    { new: true }
  )
    .select("-passwordHash")
    .lean();
}
