import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    filename: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1, max: 4 * 1024 * 1024 },
    storageKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

attachmentSchema.index({ user: 1, note: 1, createdAt: -1 });

const Attachment = mongoose.model("Attachment", attachmentSchema);

export default Attachment;
