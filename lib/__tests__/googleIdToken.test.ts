import { beforeAll, describe, expect, it } from "vitest";
import {
  createLocalJWKSet,
  exportJWK,
  exportSPKI,
  generateKeyPair,
  SignJWT,
  UnsecuredJWT,
  type CryptoKey,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import { InvalidIdTokenError, verifyGoogleIdToken } from "../server/auth/googleIdToken";

// Stand-ins for Google: a key pair whose public half plays the role of
// Google's published keys, and an attacker's key pair that isn't published.
const CLIENT_ID = "horizon-test.apps.googleusercontent.com";
let google: { publicKey: CryptoKey; privateKey: CryptoKey };
let attacker: { publicKey: CryptoKey; privateKey: CryptoKey };
let googleKeys: JWTVerifyGetKey;

beforeAll(async () => {
  google = await generateKeyPair("RS256", { extractable: true });
  attacker = await generateKeyPair("RS256");
  googleKeys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(google.publicKey)), kid: "google-key", alg: "RS256" }],
  });
});

const claims = (overrides: JWTPayload = {}): JWTPayload => ({
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  sub: "110248495921238986420",
  email: "ada@example.com",
  email_verified: true,
  name: "Ada Lovelace",
  ...overrides,
});

const sign = (payload: JWTPayload, key: CryptoKey | Uint8Array = google.privateKey, alg = "RS256", expires: string | number = "1h") =>
  new SignJWT(payload).setProtectedHeader({ alg, kid: "google-key" }).setIssuedAt().setExpirationTime(expires).sign(key);

const verify = (token: string, audience = CLIENT_ID) => verifyGoogleIdToken(token, audience, googleKeys);

const rejectsWith = (promise: Promise<unknown>, reason: string) =>
  expect(promise).rejects.toSatisfy((e) => e instanceof InvalidIdTokenError && e.reason === reason);

describe("verifyGoogleIdToken", () => {
  it("accepts a token Google signed for Horizon, and returns only what it vouches for", async () => {
    await expect(verify(await sign(claims()))).resolves.toEqual({
      sub: "110248495921238986420",
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
  });

  it("accepts Google's short issuer form too", async () => {
    await expect(verify(await sign(claims({ iss: "accounts.google.com" })))).resolves.toBeTruthy();
  });

  it("rejects a token signed with any key but Google's (S1: forgery)", async () => {
    await rejectsWith(verify(await sign(claims(), attacker.privateKey)), "ERR_JWS_SIGNATURE_VERIFICATION_FAILED");
  });

  it("rejects a genuine token Google issued to a different app (S2)", async () => {
    await rejectsWith(verify(await sign(claims({ aud: "other-app.apps.googleusercontent.com" }))), "ERR_JWT_CLAIM_VALIDATION_FAILED");
  });

  it("rejects a token from another issuer", async () => {
    await rejectsWith(verify(await sign(claims({ iss: "https://evil.example" }))), "ERR_JWT_CLAIM_VALIDATION_FAILED");
  });

  it("rejects an expired token, beyond the 30 s clock allowance", async () => {
    const twoMinutesAgo = Math.floor(Date.now() / 1000) - 120;
    await rejectsWith(verify(await sign(claims(), google.privateKey, "RS256", twoMinutesAgo)), "ERR_JWT_EXPIRED");
  });

  it("rejects an account whose email Google hasn't verified", async () => {
    await rejectsWith(verify(await sign(claims({ email_verified: false }))), "email not verified");
  });

  it("rejects a token without a subject", async () => {
    await rejectsWith(verify(await sign(claims({ sub: undefined }))), "no subject");
  });

  it("rejects an unsigned token (alg: none)", async () => {
    const unsigned = new UnsecuredJWT(claims()).setIssuedAt().setExpirationTime("1h").encode();
    await expect(verify(unsigned)).rejects.toBeInstanceOf(InvalidIdTokenError);
  });

  it("rejects HS256 keyed with Google's public key (algorithm confusion)", async () => {
    const publicKeyBytes = new TextEncoder().encode(await exportSPKI(google.publicKey));
    await expect(verify(await sign(claims(), publicKeyBytes, "HS256"))).rejects.toBeInstanceOf(InvalidIdTokenError);
  });

  it("rejects something that isn't a token at all", async () => {
    await expect(verify("not-a-token")).rejects.toBeInstanceOf(InvalidIdTokenError);
  });

  it("refuses to verify anything without a configured client ID", async () => {
    await rejectsWith(verify(await sign(claims()), ""), "no client ID configured");
  });
});
