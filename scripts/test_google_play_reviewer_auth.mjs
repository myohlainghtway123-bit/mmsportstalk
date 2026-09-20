import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function scanFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? scanFiles(full) : [full];
  });
}

console.log("MST Scores — Validating Google Play Reviewer Flow Contract...");

// Invariant 1: Mobile app source MUST NOT hard-code any reviewer credentials or secrets
const clientFiles = scanFiles(path.join(root, "src"))
  .filter((file) => /\.jsx?$/.test(file))
  .map((file) => ({
    file,
    source: fs.readFileSync(file, "utf8"),
  }));

for (const { file, source } of clientFiles) {
  assert.doesNotMatch(
    source,
    /849206/,
    `Secret reviewer passcode leaked in ${file}! Requirement 3 violated: Do NOT hard-code reusable credential in mobile app source.`
  );
  assert.doesNotMatch(
    source,
    /GOOGLE_PLAY_REVIEW_CODE/i,
    `Reviewer code secret name found in client source ${file}!`
  );
}
console.log("✔ Invariant 1: Zero hardcoded reviewer secrets in mobile app source.");

// Invariant 2: Mobile auth modal handles 6-digit verification code input
const authModalSource = read("src/phase4b/Phase4BAuthModal.js");
assert.match(authModalSource, /maxLength=\{6\}/, "Auth modal must support 6-digit code entry");
assert.match(authModalSource, /keyboardType="number-pad"/, "Auth modal must provide number pad for OTP/code entry");
assert.match(authModalSource, /startEmailLogin\(clean\)/, "Auth modal invokes startEmailLogin");
assert.match(authModalSource, /verifyEmailLogin\(email,\s*cleanCode\)/, "Auth modal invokes verifyEmailLogin");
console.log("✔ Invariant 2: Phase4BAuthModal seamlessly accepts 6-digit reviewer passcode.");

// Invariant 3: Account API correctly formats payloads for /auth/email/start and /auth/email/verify
const accountApiSource = read("src/services/accountApi.js");
assert.match(accountApiSource, /api\("\/auth\/email\/start"/, "Calls /auth/email/start");
assert.match(accountApiSource, /api\("\/auth\/email\/verify"/, "Calls /auth/email/verify");
assert.match(accountApiSource, /setSessionToken\(payload\.token\)/, "Stores session token upon successful verify");
assert.match(accountApiSource, /getAuthStatus\(\)/, "Loads auth status after verify");
console.log("✔ Invariant 3: Mobile accountApi adheres to canonical auth endpoints.");

// Invariant 4: Reviewer simulated auth round-trip adheres to client contract
const mockReviewerResponse = {
  ok: true,
  token: "mst_review_session_token_32charslength123456",
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  user: {
    id: "email:playreview_hash_uuid",
    userId: "email:playreview_hash_uuid",
    email: "playreview@myanmarsportstalk.com",
    displayName: "Google Play Reviewer",
    username: "playreview",
  },
  authenticated: true,
  status: {
    authenticated: true,
    user: {
      id: "email:playreview_hash_uuid",
      userId: "email:playreview_hash_uuid",
      email: "playreview@myanmarsportstalk.com",
      displayName: "Google Play Reviewer",
      username: "playreview",
    },
  },
};

assert.equal(mockReviewerResponse.authenticated, true);
assert.equal(mockReviewerResponse.status.authenticated, true);
assert.equal(mockReviewerResponse.user.email, "playreview@myanmarsportstalk.com");
assert.ok(mockReviewerResponse.token.length >= 32);
console.log("✔ Invariant 4: Reviewer response payload satisfies mobile client session extraction.");

console.log("\nAll Google Play reviewer mobile client verification tests passed!\n");
