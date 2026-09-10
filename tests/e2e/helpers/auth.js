import { expect } from "@playwright/test";

export function hasE2EUsers() {
  return Boolean(
    process.env.E2E_USER_A_EMAIL &&
    process.env.E2E_USER_A_PASSWORD &&
    process.env.E2E_USER_B_EMAIL &&
    process.env.E2E_USER_B_PASSWORD,
  );
}

export async function login(page, email, password) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function loginAsUserA(page) {
  return login(
    page,
    process.env.E2E_USER_A_EMAIL,
    process.env.E2E_USER_A_PASSWORD,
  );
}

export async function loginAsUserB(page) {
  return login(
    page,
    process.env.E2E_USER_B_EMAIL,
    process.env.E2E_USER_B_PASSWORD,
  );
}

export function requireE2EUsers(test) {
  test.skip(
    !hasE2EUsers(),
    "Set E2E_USER_A/B_EMAIL and E2E_USER_A/B_PASSWORD for isolated authenticated tests",
  );
}
