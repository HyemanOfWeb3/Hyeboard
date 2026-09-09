import mongoose from "mongoose";

const collaborationEventSchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: "Note", required: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["note.updated", "note.deleted", "note.restored", "member.changed", "presence.joined", "presence.left"], required: true },
    revision: { type: Number, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

collaborationEventSchema.index({ note: 1, createdAt: -1 });

const CollaborationEvent = mongoose.model("CollaborationEvent", collaborationEventSchema);
export default CollaborationEvent;
