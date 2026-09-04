import mongoose from "mongoose";

const knowledgeDocSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    agencyId: { type: String, default: null, index: true },
    docType: {
      type: String,
      enum: ["sop", "faq", "policy", "guide"],
      default: "sop",
    },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: String, default: null },
  },
  { timestamps: true }
);

export const KnowledgeDoc = mongoose.model("KnowledgeDoc", knowledgeDocSchema);
