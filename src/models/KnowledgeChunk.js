import mongoose from "mongoose";

const knowledgeChunkSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ["case", "sop", "correction", "faq"],
      required: true,
      index: true,
    },
    sourceId: { type: String, default: null, index: true },
    text: { type: String, required: true },
    embedding: { type: [Number], default: [] },
    metadata: {
      categoryId: { type: String, default: null },
      agencyId: { type: String, default: null },
      daerah: { type: String, default: null },
      title: { type: String, default: null },
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

knowledgeChunkSchema.index({ sourceType: 1, createdAt: -1 });

export const KnowledgeChunk = mongoose.model(
  "KnowledgeChunk",
  knowledgeChunkSchema
);
