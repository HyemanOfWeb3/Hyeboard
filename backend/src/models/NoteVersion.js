import mongoose from "mongoose";

const noteVersionSchema = new mongoose.Schema(
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
    revision: {
      type: Number,
      required: true,
      min: 1,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    isPinned: Boolean,
    isFavorite: Boolean,
    deletedAt: {
      type: Date,
      default: null,
    },
    operationType: {
      type: String,
      enum: ["UPDATE_NOTE", "DELETE_NOTE", "RESTORE_NOTE", "RESTORE_VERSION"],
      default: "UPDATE_NOTE",
    },
  },
  { timestamps: true },
);

noteVersionSchema.index({ user: 1, note: 1, revision: 1 }, { unique: true });
noteVersionSchema.index({ user: 1, note: 1, createdAt: -1 });

const NoteVersion = mongoose.model("NoteVersion", noteVersionSchema);

export default NoteVersion;
