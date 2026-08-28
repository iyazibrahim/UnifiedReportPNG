import mongoose from "mongoose";

export const USER_ROLES = [
  "super_admin",
  "admin",
  "agency_admin",
  "agency_operator",
];

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, index: true, required: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "agency_operator",
      index: true,
    },
    agencyId: { type: String, default: null, index: true },
    displayName: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
