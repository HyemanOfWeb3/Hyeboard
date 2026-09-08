# HyeBoard Hardening Tests

The test suite is intentionally separated from production configuration.

## API tests

Use a disposable MongoDB database whose name contains `test`:

```powershell
$env:NODE_ENV = "test"
$env:TEST_MONGO_URI = "mongodb://127.0.0.1:27017/hyeboard_test"
$env:TEST_AUTH_SECRET = "a-test-only-secret"
npm run test:api
```

The API suite refuses to run without `TEST_MONGO_URI` and `TEST_AUTH_SECRET` and
will not use `MONGO_URI` as a fallback.

## Browser tests

Install a browser once with `npx playwright install chromium`, then provide the
two disposable test users from `.env.test.example`:

```powershell
$env:E2E_USER_A_EMAIL = "e2e-a@example.test"
$env:E2E_USER_A_PASSWORD = "test-password-a-123"
$env:E2E_USER_B_EMAIL = "e2e-b@example.test"
$env:E2E_USER_B_PASSWORD = "test-password-b-123"
npm run test:e2e
```

Tests that require credentials are reported as skipped when the isolated test
environment is not configured. The mobile login/overflow smoke test remains
available without credentials.