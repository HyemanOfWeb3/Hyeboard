import mongoose from "mongoose";

// 1 - create schema
// 2 - create a model based off of that schema

const noteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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
    isPinned: {
      type: Boolean,
      default: false,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    revision: {
      type: Number,
      default: 1,
      min: 1,
    },
    clientNoteId: {
      type: String,
      default: null,
    },
  },

  { timestamps: true }, // createdAt, updatedAt
);

noteSchema.index(
  { user: 1, clientNoteId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientNoteId: { $type: "string" } },
  },
);

const Note = mongoose.model("Note", noteSchema);

export default Note;
