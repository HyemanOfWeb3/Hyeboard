import assert from "node:assert/strict";
import test from "node:test";
import { canEdit, canManage, canRead, createInviteToken, hashInviteToken, ROLES } from "../src/services/collaborationService.js";

test("collaboration roles have explicit permissions", () => {
  assert.equal(canRead(ROLES.OWNER), true);
  assert.equal(canRead(ROLES.EDITOR), true);
  assert.equal(canRead(ROLES.VIEWER), true);
  assert.equal(canEdit(ROLES.OWNER), true);
  assert.equal(canEdit(ROLES.EDITOR), true);
  assert.equal(canEdit(ROLES.VIEWER), false);
  assert.equal(canManage(ROLES.OWNER), true);
  assert.equal(canManage(ROLES.EDITOR), false);
  assert.equal(canManage(ROLES.VIEWER), false);
  assert.equal(canRead(null), false);
});

test("invitation tokens are random and hash-verifiable", () => {
  const first = createInviteToken();
  const second = createInviteToken();
  assert.notEqual(first.token, second.token);
  assert.equal(hashInviteToken(first.token), first.tokenHash);
  assert.notEqual(hashInviteToken(first.token), hashInviteToken(second.token));
});
