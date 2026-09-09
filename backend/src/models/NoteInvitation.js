import mongoose from "mongoose";

const noteInvitationSchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: "Note", required: true, index: true },
    inviter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    inviteeEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ["editor", "viewer"], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const NoteInvitation = mongoose.model("NoteInvitation", noteInvitationSchema);
export default NoteInvitation;
