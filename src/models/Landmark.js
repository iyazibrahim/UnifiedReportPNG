import mongoose from "mongoose";
import { LANDMARK_CATEGORIES } from "../location/landmarkCategory.js";

const landmarkSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    aliases: { type: [String], default: [] },
    category: {
      type: String,
      default: "landmark",
      enum: LANDMARK_CATEGORIES,
      index: true,
    },
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
    side: {
      type: String,
      enum: ["pulau", "seberang", "outside"],
      default: "outside",
    },
    source: {
      type: String,
      enum: ["osm", "google", "merged", "curated"],
      default: "curated",
    },
    osmId: { type: String, default: null, sparse: true },
    googlePlaceId: { type: String, default: null, sparse: true },
    address: { type: String, default: "" },
  },
  { timestamps: true }
);

landmarkSchema.index({ name: "text", aliases: "text" });
landmarkSchema.index({ lat: 1, lng: 1 });

export const Landmark = mongoose.model("Landmark", landmarkSchema);
