import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";
import Note from "../src/models/Note.js";
import User from "../src/models/User.js";

const enabled =
  process.env.NODE_ENV === "test" &&
  process.env.TEST_AUTH_SECRET &&
  process.env.TEST_MONGO_URI &&
  /(?:test|localhost|127\.0\.0\.1)/i.test(process.env.TEST_MONGO_URI);

let userA;
let userB;
let agentA;
let agentB;
let privateNote;

before(async () => {
  if (!enabled) return;
  process.env.AUTH_SECRET = process.env.TEST_AUTH_SECRET;
  await connectDB();
  await Promise.all([Note.deleteMany({}), User.deleteMany({})]);
  const passwordHash = await bcrypt.hash("test-password-a-123", 4);
  [userA, userB] = await User.create([
    { email: "e2e-a@example.test", passwordHash },
    { email: "e2e-b@example.test", passwordHash },
  ]);
  privateNote = await Note.create({
    user: userA._id,
    title: "Private A",
    content: "User A content",
    clientNoteId: "test-private-a",
  });
  agentA = request.agent(app);
  agentB = request.agent(app);
  await agentA.post("/api/auth/login").send({ email: userA.email, password: "test-password-a-123" }).expect(200);
  await agentB.post("/api/auth/login").send({ email: userB.email, password: "test-password-a-123" }).expect(200);
});

after(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
});

test("authenticated users cannot read another user's note", { skip: !enabled }, async () => {
  await agentA.get(`/api/notes/${privateNote._id}`).expect(200);
  const response = await agentB.get(`/api/notes/${privateNote._id}`).expect(404);
  assert.equal(response.body.message, "Note not found");
});

test("authenticated users cannot mutate another user's note", { skip: !enabled }, async () => {
  await agentB.put(`/api/notes/${privateNote._id}`).send({
    title: "Tampered",
    content: "Should not apply",
    baseRevision: 1,
    operationId: "e2e-cross-user-update",
  }).expect(404);
  const note = await Note.findById(privateNote._id).lean();
  assert.equal(note.title, "Private A");
});

test("unauthenticated note and attachment routes are rejected", { skip: !enabled }, async () => {
  await request(app).get(`/api/notes/${privateNote._id}`).expect(401);
  await request(app).get(`/api/attachments/note/${privateNote._id}`).expect(401);
});