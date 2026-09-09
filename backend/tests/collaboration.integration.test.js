import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";
import Note from "../src/models/Note.js";
import NoteInvitation from "../src/models/NoteInvitation.js";
import User from "../src/models/User.js";
import { createInviteToken } from "../src/services/collaborationService.js";

const enabled = process.env.NODE_ENV === "test" && process.env.TEST_AUTH_SECRET && process.env.TEST_MONGO_URI && /(?:test|localhost|127\.0\.0\.1)/i.test(process.env.TEST_MONGO_URI);
let owner;
let editor;
let viewer;
let note;
let ownerAgent;
let editorAgent;
let viewerAgent;

test.beforeEach((context) => { if (!enabled) context.skip("Requires isolated TEST_MONGO_URI and TEST_AUTH_SECRET"); });

before(async () => {
  if (!enabled) return;
  process.env.AUTH_SECRET = process.env.TEST_AUTH_SECRET;
  await connectDB();
  await Promise.all([Note.deleteMany({}), User.deleteMany({}), NoteInvitation.deleteMany({})]);
  const passwordHash = await bcrypt.hash("test-password-123", 4);
  [owner, editor, viewer] = await User.create([
    { email: "collab-owner@example.test", passwordHash },
    { email: "collab-editor@example.test", passwordHash },
    { email: "collab-viewer@example.test", passwordHash },
  ]);
  note = await Note.create({ user: owner._id, title: "Shared note", content: "Owner content", clientNoteId: "collab-shared-note" });
  ownerAgent = request.agent(app);
  editorAgent = request.agent(app);
  viewerAgent = request.agent(app);
  await ownerAgent.post("/api/auth/login").send({ email: owner.email, password: "test-password-123" }).expect(200);
  await editorAgent.post("/api/auth/login").send({ email: editor.email, password: "test-password-123" }).expect(200);
  await viewerAgent.post("/api/auth/login").send({ email: viewer.email, password: "test-password-123" }).expect(200);
});

after(async () => { if (mongoose.connection.readyState) await mongoose.disconnect(); });

test("owner can invite editor and viewer, permissions are enforced, and revocation removes access", async () => {
  if (!enabled) return;
  const editorInvite = await ownerAgent.post(`/api/collaboration/notes/${note._id}/invitations`).send({ email: editor.email, role: "editor" }).expect(201);
  const viewerInvite = await ownerAgent.post(`/api/collaboration/notes/${note._id}/invitations`).send({ email: viewer.email, role: "viewer" }).expect(201);
  await editorAgent.post("/api/collaboration/invitations/accept").send({ token: editorInvite.body.token }).expect(200);
  await viewerAgent.post("/api/collaboration/invitations/accept").send({ token: viewerInvite.body.token }).expect(200);
  await editorAgent.get(`/api/notes/${note._id}`).expect(200);
  await viewerAgent.get(`/api/notes/${note._id}`).expect(200);
  await editorAgent.put(`/api/notes/${note._id}`).send({ title: "Editor update", content: "Edited", baseRevision: 1, operationId: "collab-editor-update" }).expect(200);
  await viewerAgent.put(`/api/notes/${note._id}`).send({ title: "Denied", content: "Denied", baseRevision: 2, operationId: "collab-viewer-update" }).expect(403);
  await ownerAgent.delete(`/api/collaboration/notes/${note._id}/members/${viewer._id}`).expect(200);
  await viewerAgent.get(`/api/notes/${note._id}`).expect(404);
});

test("expired invitation is rejected", async () => {
  if (!enabled) return;
  const { token, tokenHash } = createInviteToken();
  await NoteInvitation.create({ note: note._id, inviter: owner._id, inviteeEmail: viewer.email, role: "viewer", tokenHash, expiresAt: new Date(Date.now() - 1000) });
  await viewerAgent.post("/api/collaboration/invitations/accept").send({ token }).expect(404);
});

assert.equal(typeof enabled, "boolean");
