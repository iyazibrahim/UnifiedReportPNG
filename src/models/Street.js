import mongoose from "mongoose";

const streetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    aliases: { type: [String], default: [] },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    daerah: {
      type: String,
      enum: [
        "timur_laut",
        "barat_daya",
        "spu",
        "spt",
        "sps",
        "unknown",
      ],
      default: "unknown",
      index: true,
    },
    source: {
      type: String,
      enum: ["gps_detected", "ai_verified", "osm", "citizen_confirmed"],
      default: "citizen_confirmed",
    },
    confirmCount: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

streetSchema.index({ name: "text", aliases: "text" });
streetSchema.index({ lat: 1, lng: 1 });

export const Street = mongoose.model("Street", streetSchema);
