// Checks a Google ID token: the signed statement Google's "Sign in with
// Google" hands the browser, saying which Google account just signed in.
// The browser forwards it to us, so until it's verified, it's just a string
// anyone could have written. Verifying it means:
//
// - Signature. Google signs with RS256 (an RSA private key only Google holds)
//   and publishes the matching public keys as a JWKS. A valid signature proves
//   Google issued the token and nobody changed it since (threat S1). Only
//   RS256 is accepted, so a token can't talk its way into a weaker algorithm
//   ("none", or HS256 keyed with the public key).
// - Issuer (`iss`): Google, not some other identity provider.
// - Audience (`aud`): Horizon's own client ID. A genuine token Google issued
//   to a different app must not work here (threat S2).
// - Expiry (`exp`): Google's tokens last about an hour.
// - `email_verified`: Google has confirmed the address belongs to the account.

import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Fetched on first use and cached; jose refetches when a token names a key
// it hasn't seen, which is how Google's key rotation is picked up.
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface GoogleIdentity {
  /** Google's permanent id for the account. */
  sub: string;
  email: string;
  name: string;
}

export class InvalidIdTokenError extends Error {
  name = "InvalidIdTokenError";
  /** A short machine-readable reason, safe to log. Never the token. */
  constructor(readonly reason: string) {
    super(`Invalid Google ID token: ${reason}`);
  }
}

export async function verifyGoogleIdToken(
  token: string,
  audience: string,
  keys: JWTVerifyGetKey = googleKeys
): Promise<GoogleIdentity> {
  if (!audience) throw new InvalidIdTokenError("no client ID configured");

  let payload;
  try {
    ({ payload } = await jwtVerify(token, keys, {
      issuer: GOOGLE_ISSUERS,
      audience,
      algorithms: ["RS256"],
      clockTolerance: 30, // seconds of clock skew between us and Google
    }));
  } catch (error) {
    throw new InvalidIdTokenError(error instanceof errors.JOSEError ? error.code : "unreadable token");
  }

  if (typeof payload.sub !== "string" || payload.sub === "") throw new InvalidIdTokenError("no subject");
  if (typeof payload.email !== "string") throw new InvalidIdTokenError("no email");
  if (payload.email_verified !== true) throw new InvalidIdTokenError("email not verified");

  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : "",
  };
}
