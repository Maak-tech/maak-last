/**
 * SMART on FHIR Authorization Server
 *
 * Implements OAuth 2.0 / SMART on FHIR v1 for EHR integration.
 * Discovery document is served by fhirApi.ts at:
 *   GET /.well-known/smart-configuration
 *
 * Routes (this Cloud Function):
 *   POST /auth/register              — Register an OAuth client (API-key authenticated)
 *   GET  /auth/authorize             — Show HTML consent screen
 *   POST /auth/authorize             — Process consent decision → redirect with code
 *   POST /auth/token                 — Token endpoint
 *   POST /auth/token/introspect      — Token introspection (RFC 7662)
 *   GET  /.well-known/jwks.json      — JSON Web Key Set (RSA public key)
 *
 * Supported grant types:
 *   authorization_code  — PKCE (S256) mandatory; patient/user context access
 *   client_credentials  — system-to-system backend access
 *   refresh_token       — token rotation (single-use refresh tokens)
 *
 * Security design:
 *   - RSA-2048 key pair generated once, stored in Firestore config/smart_auth
 *   - RS256 signed JWTs (access tokens + ID tokens)
 *   - Refresh tokens stored as SHA-256 hashes (never plaintext)
 *   - Auth codes: single-use, 10-minute TTL
 *   - PKCE mandatory for authorization_code flow
 *   - Confidential clients use client_secret (SHA-256 hashed at rest)
 *
 * Firestore collections:
 *   oauth_clients/{clientId}          — registered EHR applications
 *   oauth_auth_codes/{code}           — short-lived auth codes
 *   oauth_refresh_tokens/{tokenHash}  — hashed refresh tokens (30-day TTL)
 *   oauth_access_tokens/{jti}         — issued tokens (for introspection/revocation)
 *   config/smart_auth                 — RSA key pair (written once on first deploy)
 *
 * Production note:
 *   Firebase Hosting rewrites should map /auth/* and /.well-known/jwks.json
 *   to this Cloud Function so that EHRs see a unified domain.
 *
 * Compliance:
 *   - SMART on FHIR v1 (https://docs.smarthealthit.org/authorization/)
 *   - RFC 7662 Token Introspection
 *   - RFC 7517 JSON Web Key
 *   - RFC 7636 PKCE
 */

import {
  createHash,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  randomBytes,
} from "crypto";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import type { Response } from "firebase-functions/v1";
import { type ApiRequest, authenticateApiKey } from "../middleware/apiAuth";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";

const db = () => getFirestore();

// ─── Constants ─────────────────────────────────────────────────────────────────

const KEY_ID = "maak-v1";
const ACCESS_TOKEN_TTL = 3_600; // 1 hour (seconds)
const REFRESH_TOKEN_TTL = 30 * 24 * 3_600; // 30 days (seconds)
const AUTH_CODE_TTL = 600; // 10 minutes (seconds)

// ─── Scope Labels (plain language for consent screen) ──────────────────────────

const SCOPE_LABELS: Record<string, string> = {
  openid: "Verify your identity",
  fhirUser: "Access your FHIR user profile",
  launch: "Launch from your EHR system",
  "launch/patient": "Access the current patient context from the EHR",
  "patient/*.read": "Read all health data for this patient",
  "patient/Observation.read": "Read vital signs and lab results",
  "patient/MedicationRequest.read": "Read active medication list",
  "patient/Patient.read": "Read patient demographic information",
  "system/*.read": "Read all patient data (system-level access)",
  offline_access: "Maintain access while not using the application",
};

// ─── Crypto Helpers ────────────────────────────────────────────────────────────

function base64url(input: string | Buffer): string {
  const b64 = Buffer.isBuffer(input)
    ? input.toString("base64")
    : Buffer.from(input).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function sha256hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function verifyPkceS256(verifier: string, challenge: string): boolean {
  const computed = base64url(createHash("sha256").update(verifier).digest());
  return computed === challenge;
}

function signJwt(
  payload: Record<string, unknown>,
  privateKeyPem: string
): string {
  const header = { alg: "RS256", typ: "JWT", kid: KEY_ID };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  return `${signingInput}.${base64url(sign.sign(privateKeyPem))}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractBasicAuth(req: functions.https.Request): {
  id: string | null;
  secret: string | null;
} {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Basic ")) return { id: null, secret: null };
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
  const sep = decoded.indexOf(":");
  if (sep === -1) return { id: decoded, secret: null };
  return { id: decoded.slice(0, sep), secret: decoded.slice(sep + 1) };
}

// ─── RSA Key Store ─────────────────────────────────────────────────────────────

type KeyStore = {
  privateKeyPem: string;
  publicKeyJwk: Record<string, unknown>;
};

let keyCache: KeyStore | null = null;

/**
 * Load the RSA key pair from Firestore, generating it on first call.
 * Module-level cache avoids repeated Firestore reads per warm instance.
 */
async function getOrCreateKeyStore(): Promise<KeyStore> {
  if (keyCache) return keyCache;

  const ref = db().collection("config").doc("smart_auth");
  const snap = await ref.get();

  if (snap.exists) {
    const d = snap.data()!;
    keyCache = {
      privateKeyPem: d.privateKeyPem as string,
      publicKeyJwk: d.publicKeyJwk as Record<string, unknown>,
    };
    return keyCache;
  }

  // Generate RSA-2048 key pair (runs only once per project lifetime)
  logger.info("smartAuth: generating RSA-2048 key pair", {
    fn: "getOrCreateKeyStore",
  });

  const kp = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  }) as { privateKey: string; publicKey: string };

  const jwkRaw = createPublicKey(kp.publicKey).export({
    format: "jwk",
  }) as Record<string, unknown>;

  const publicKeyJwk = { ...jwkRaw, use: "sig", alg: "RS256", kid: KEY_ID };

  await ref.set({
    privateKeyPem: kp.privateKey,
    publicKeyJwk,
    createdAt: FieldValue.serverTimestamp(),
  });

  keyCache = { privateKeyPem: kp.privateKey, publicKeyJwk };
  return keyCache;
}

// ─── HTML Consent Screen ───────────────────────────────────────────────────────

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function buildConsentHtml(p: {
  clientName: string;
  scopes: string[];
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  patientId?: string;
  userId?: string;
}): string {
  const scopeItems = p.scopes
    .filter((s) => s !== "openid" && s !== "offline_access")
    .map((s) => {
      const label = SCOPE_LABELS[s] ?? s;
      return `<li><span class="icon">✓</span>${escHtml(label)}</li>`;
    })
    .join("\n      ");

  const hidden = [
    `<input type="hidden" name="client_id" value="${escHtml(p.clientId)}">`,
    `<input type="hidden" name="redirect_uri" value="${escHtml(p.redirectUri)}">`,
    `<input type="hidden" name="scope" value="${escHtml(p.scopes.join(" "))}">`,
    `<input type="hidden" name="state" value="${escHtml(p.state)}">`,
    `<input type="hidden" name="code_challenge" value="${escHtml(p.codeChallenge)}">`,
    `<input type="hidden" name="code_challenge_method" value="${escHtml(p.codeChallengeMethod)}">`,
    p.patientId
      ? `<input type="hidden" name="patient_id" value="${escHtml(p.patientId)}">`
      : "",
    p.userId
      ? `<input type="hidden" name="user_id" value="${escHtml(p.userId)}">`
      : "",
  ]
    .filter(Boolean)
    .join("\n      ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Access — Maak Health</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#F0F9FF;min-height:100vh;display:flex;
         align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:16px;padding:32px;
          max-width:440px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .logo{display:flex;align-items:center;gap:10px;margin-bottom:24px}
    .logo-icon{width:40px;height:40px;background:#0EA5E9;border-radius:10px;
               display:flex;align-items:center;justify-content:center;
               color:#fff;font-size:22px}
    .logo-text{font-weight:700;font-size:18px;color:#0F172A}
    h1{font-size:18px;font-weight:700;color:#0F172A;margin-bottom:6px;line-height:1.4}
    .app{color:#0EA5E9}
    .sub{font-size:13px;color:#64748B;margin-bottom:20px}
    ul{list-style:none;border:1px solid #E2E8F0;border-radius:10px;
       overflow:hidden;margin-bottom:24px}
    li{padding:11px 14px;border-bottom:1px solid #F1F5F9;
       display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#334155}
    li:last-child{border-bottom:none}
    .icon{color:#10B981;flex-shrink:0}
    .actions{display:flex;gap:10px}
    .btn{flex:1;padding:12px;border:none;border-radius:10px;
         font-size:15px;font-weight:600;cursor:pointer}
    .allow{background:#0EA5E9;color:#fff}
    .deny{background:#F1F5F9;color:#475569}
    .footer{margin-top:16px;font-size:11px;color:#94A3B8;
            text-align:center;line-height:1.6}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">🏥</div>
      <span class="logo-text">Maak Health</span>
    </div>
    <h1><span class="app">${escHtml(p.clientName)}</span> is requesting<br>access to health data</h1>
    <p class="sub">This application will be able to:</p>
    <ul>
      ${scopeItems}
    </ul>
    <form method="POST" action="/auth/authorize">
      ${hidden}
      <div class="actions">
        <button type="submit" name="decision" value="deny" class="btn deny">Deny</button>
        <button type="submit" name="decision" value="allow" class="btn allow">Allow Access</button>
      </div>
    </form>
    <p class="footer">
      By clicking Allow, you consent to sharing the listed data with ${escHtml(p.clientName)}.<br>
      You can revoke this access at any time in your account settings.
    </p>
  </div>
</body>
</html>`;
}

// ─── Route Parsing ─────────────────────────────────────────────────────────────

type SmartRoute =
  | { route: "jwks" }
  | { route: "register" }
  | { route: "authorize" }
  | { route: "token" }
  | { route: "introspect" }
  | null;

function parseRoute(path: string): SmartRoute {
  if (path === "/.well-known/jwks.json") return { route: "jwks" };
  if (path === "/auth/register") return { route: "register" };
  if (path === "/auth/authorize") return { route: "authorize" };
  if (path === "/auth/token") return { route: "token" };
  if (path === "/auth/token/introspect") return { route: "introspect" };
  return null;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/** GET /.well-known/jwks.json — return RSA public key as JWK Set */
async function handleJwks(res: Response): Promise<void> {
  const keys = await getOrCreateKeyStore();
  res.json({ keys: [keys.publicKeyJwk] });
}

// ─── POST /auth/register ───────────────────────────────────────────────────────

/**
 * Register an OAuth client (EHR application).
 * Requires a valid Maak API key in the Authorization header.
 * Returns client_id and client_secret (secret shown only once).
 */
async function handleRegister(req: ApiRequest, res: Response): Promise<void> {
  const authenticated = await authenticateApiKey(req, res);
  if (!authenticated) return;

  const body = req.body as Record<string, unknown>;
  const {
    client_name,
    redirect_uris,
    scope,
    application_type = "confidential",
    require_user_consent = true,
  } = body;

  if (
    !client_name ||
    typeof client_name !== "string" ||
    !Array.isArray(redirect_uris) ||
    redirect_uris.length === 0
  ) {
    res.status(400).json({
      error: "invalid_request",
      error_description:
        "client_name (string) and redirect_uris (non-empty array) are required",
    });
    return;
  }

  const allowedScopes =
    typeof scope === "string"
      ? scope.split(" ")
      : Array.isArray(scope)
        ? (scope as string[])
        : ["patient/*.read"];

  const orgId = req.apiAuth!.orgId;
  const clientId = generateToken(16);
  const clientSecret = generateToken(32);

  await db()
    .collection("oauth_clients")
    .doc(clientId)
    .set({
      clientId,
      clientSecretHash: sha256hex(clientSecret),
      clientName: client_name,
      redirectUris: redirect_uris as string[],
      allowedScopes,
      applicationType: application_type as string,
      requireUserConsent: require_user_consent as boolean,
      orgId,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    });

  logger.info("smartAuth: client registered", {
    clientId,
    orgId,
    clientName: client_name,
    fn: "handleRegister",
  });

  res.status(201).json({
    client_id: clientId,
    client_secret: clientSecret, // plaintext shown only at registration
    client_name,
    redirect_uris,
    scope: allowedScopes.join(" "),
    token_endpoint_auth_method:
      application_type === "public" ? "none" : "client_secret_basic",
  });
}

// ─── GET /auth/authorize ───────────────────────────────────────────────────────

/** Show HTML consent screen (or auto-redirect for trusted clients). */
async function handleAuthorizeGet(
  req: ApiRequest,
  res: Response
): Promise<void> {
  const q = req.query as Record<string, string>;
  const {
    response_type,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    launch,
    patient,
  } = q;

  if (response_type !== "code") {
    res
      .status(400)
      .json({ error: "unsupported_response_type", state: state ?? undefined });
    return;
  }

  if (!(client_id && redirect_uri && scope && code_challenge)) {
    res.status(400).json({
      error: "invalid_request",
      error_description:
        "Required: client_id, redirect_uri, scope, code_challenge",
    });
    return;
  }

  if ((code_challenge_method ?? "S256") !== "S256") {
    res.status(400).json({
      error: "invalid_request",
      error_description: "Only code_challenge_method=S256 is supported",
    });
    return;
  }

  // Validate client
  const clientSnap = await db()
    .collection("oauth_clients")
    .doc(client_id)
    .get();
  if (!clientSnap.exists || !clientSnap.data()?.isActive) {
    res.status(400).json({ error: "invalid_client" });
    return;
  }

  const clientData = clientSnap.data()!;

  // Validate redirect_uri is registered
  if (!(clientData.redirectUris as string[]).includes(redirect_uri)) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "redirect_uri not registered for this client",
    });
    return;
  }

  // Patient context from EHR launch token or explicit param
  const patientId = patient ?? launch ?? undefined;

  // Auto-approve trusted clients (no user interaction required)
  if (!clientData.requireUserConsent) {
    const code = await issueAuthCode({
      clientId: client_id,
      orgId: clientData.orgId as string,
      userId: "system",
      patientId: patientId ?? "",
      redirectUri: redirect_uri,
      scope,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method ?? "S256",
    });

    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);
    res.redirect(302, url.toString());
    return;
  }

  // Show consent screen
  res.type("text/html").send(
    buildConsentHtml({
      clientName: clientData.clientName as string,
      scopes: scope.split(" "),
      clientId: client_id,
      redirectUri: redirect_uri,
      state: state ?? "",
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method ?? "S256",
      patientId,
    })
  );
}

// ─── POST /auth/authorize ──────────────────────────────────────────────────────

/** Process the consent form decision. */
async function handleAuthorizePost(
  req: ApiRequest,
  res: Response
): Promise<void> {
  const body = req.body as Record<string, string>;
  const {
    decision,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    patient_id,
    user_id,
  } = body;

  if (!(client_id && redirect_uri)) {
    res.status(400).send("Invalid request: missing client_id or redirect_uri");
    return;
  }

  // Re-validate client and redirect_uri (CSRF protection)
  const clientSnap = await db()
    .collection("oauth_clients")
    .doc(client_id)
    .get();
  if (!clientSnap.exists || !clientSnap.data()?.isActive) {
    res.status(400).send("Invalid client");
    return;
  }
  if (
    !(clientSnap.data()!.redirectUris as string[]).includes(redirect_uri)
  ) {
    res.status(400).send("Invalid redirect_uri");
    return;
  }

  if (decision !== "allow") {
    const url = new URL(redirect_uri);
    url.searchParams.set("error", "access_denied");
    url.searchParams.set("error_description", "The user denied access");
    if (state) url.searchParams.set("state", state);
    res.redirect(302, url.toString());
    return;
  }

  const clientData = clientSnap.data()!;
  const code = await issueAuthCode({
    clientId: client_id,
    orgId: clientData.orgId as string,
    userId: user_id ?? "patient",
    patientId: patient_id ?? "",
    redirectUri: redirect_uri,
    scope: scope ?? "patient/*.read",
    codeChallenge: code_challenge ?? "",
    codeChallengeMethod: code_challenge_method ?? "S256",
  });

  const url = new URL(redirect_uri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  res.redirect(302, url.toString());
}

// ─── Auth Code Issuer ─────────────────────────────────────────────────────────

async function issueAuthCode(params: {
  clientId: string;
  orgId: string;
  userId: string;
  patientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}): Promise<string> {
  const code = generateToken(32);
  const expiresAt = Timestamp.fromMillis(Date.now() + AUTH_CODE_TTL * 1000);
  await db().collection("oauth_auth_codes").doc(code).set({
    ...params,
    code,
    expiresAt,
    used: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  return code;
}

// ─── POST /auth/token ─────────────────────────────────────────────────────────

async function handleToken(req: ApiRequest, res: Response): Promise<void> {
  const body = req.body as Record<string, string>;
  const grantType = body.grant_type;
  const keys = await getOrCreateKeyStore();

  if (grantType === "authorization_code") {
    await handleAuthCodeGrant(req, body, keys, res);
  } else if (grantType === "client_credentials") {
    await handleClientCredentialsGrant(req, body, keys, res);
  } else if (grantType === "refresh_token") {
    await handleRefreshTokenGrant(req, body, keys, res);
  } else {
    res.status(400).json({
      error: "unsupported_grant_type",
      error_description:
        "Supported: authorization_code, client_credentials, refresh_token",
    });
  }
}

async function handleAuthCodeGrant(
  req: ApiRequest,
  body: Record<string, string>,
  keys: KeyStore,
  res: Response
): Promise<void> {
  const { code, redirect_uri, code_verifier } = body;
  const basic = extractBasicAuth(req as functions.https.Request);
  const clientId = body.client_id ?? basic.id ?? null;

  if (!(code && redirect_uri && code_verifier)) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "code, redirect_uri, and code_verifier are required",
    });
    return;
  }

  const codeSnap = await db()
    .collection("oauth_auth_codes")
    .doc(code)
    .get();
  if (!codeSnap.exists) {
    res
      .status(400)
      .json({ error: "invalid_grant", error_description: "Code not found" });
    return;
  }

  const cd = codeSnap.data()!;

  if (cd.used) {
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Authorization code already used",
    });
    return;
  }

  if (Date.now() > (cd.expiresAt as Timestamp).toMillis()) {
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Authorization code expired",
    });
    return;
  }

  if (!verifyPkceS256(code_verifier, cd.codeChallenge as string)) {
    res.status(400).json({
      error: "invalid_grant",
      error_description: "PKCE code_verifier does not match code_challenge",
    });
    return;
  }

  if (cd.redirectUri !== redirect_uri) {
    res.status(400).json({
      error: "invalid_grant",
      error_description: "redirect_uri mismatch",
    });
    return;
  }

  // Authenticate confidential client
  const clientSnap = await db()
    .collection("oauth_clients")
    .doc(cd.clientId as string)
    .get();
  if (!clientSnap.exists) {
    res.status(401).json({ error: "invalid_client" });
    return;
  }
  const clientData = clientSnap.data()!;

  if (clientData.applicationType === "confidential") {
    const secret = body.client_secret ?? basic.secret ?? null;
    if (!clientId || sha256hex(secret ?? "") !== clientData.clientSecretHash) {
      res.status(401).json({ error: "invalid_client" });
      return;
    }
  }

  // Mark code as used (single-use)
  await db()
    .collection("oauth_auth_codes")
    .doc(code)
    .update({ used: true, usedAt: FieldValue.serverTimestamp() });

  const { accessToken, jti, now } = await mintAccessToken(
    {
      sub: cd.userId as string,
      scope: cd.scope as string,
      orgId: cd.orgId as string,
      patientId: cd.patientId as string,
      clientId: cd.clientId as string,
    },
    keys
  );

  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    scope: cd.scope,
    patient: (cd.patientId as string) || undefined,
  };

  if ((cd.scope as string).includes("openid")) {
    response.id_token = buildIdToken(
      cd.userId as string,
      cd.patientId as string,
      now,
      keys
    );
  }

  if (
    (cd.scope as string).includes("offline_access") ||
    (cd.scope as string).includes("launch")
  ) {
    response.refresh_token = await issueRefreshToken({
      linkedJti: jti,
      clientId: cd.clientId as string,
      orgId: cd.orgId as string,
      userId: cd.userId as string,
      patientId: cd.patientId as string,
      scope: cd.scope as string,
    });
  }

  res.json(response);
}

async function handleClientCredentialsGrant(
  req: ApiRequest,
  body: Record<string, string>,
  keys: KeyStore,
  res: Response
): Promise<void> {
  const basic = extractBasicAuth(req as functions.https.Request);
  const clientId = body.client_id ?? basic.id ?? null;
  const clientSecret = body.client_secret ?? basic.secret ?? null;

  if (!(clientId && clientSecret)) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "client_id and client_secret are required",
    });
    return;
  }

  const clientSnap = await db()
    .collection("oauth_clients")
    .doc(clientId)
    .get();
  if (!clientSnap.exists || !clientSnap.data()?.isActive) {
    res.status(401).json({ error: "invalid_client" });
    return;
  }

  const clientData = clientSnap.data()!;
  if (sha256hex(clientSecret) !== clientData.clientSecretHash) {
    res.status(401).json({ error: "invalid_client" });
    return;
  }

  const grantedScope =
    body.scope ?? (clientData.allowedScopes as string[]).join(" ");

  const { accessToken } = await mintAccessToken(
    {
      sub: clientId,
      scope: grantedScope,
      orgId: clientData.orgId as string,
      patientId: "",
      clientId,
      extra: { client_credentials: true },
    },
    keys
  );

  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    scope: grantedScope,
  });
}

async function handleRefreshTokenGrant(
  req: ApiRequest,
  body: Record<string, string>,
  keys: KeyStore,
  res: Response
): Promise<void> {
  const { refresh_token } = body;
  const basic = extractBasicAuth(req as functions.https.Request);
  const clientId = body.client_id ?? basic.id ?? null;
  const clientSecret = body.client_secret ?? basic.secret ?? null;

  if (!refresh_token) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "refresh_token is required",
    });
    return;
  }

  const tokenHash = sha256hex(refresh_token);
  const tokenSnap = await db()
    .collection("oauth_refresh_tokens")
    .doc(tokenHash)
    .get();

  if (!tokenSnap.exists) {
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Refresh token not found",
    });
    return;
  }

  const td = tokenSnap.data()!;

  if (td.rotatedAt) {
    // Token reuse detected — potential replay attack
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Refresh token already rotated (possible replay attack)",
    });
    return;
  }

  if (Date.now() > (td.expiresAt as Timestamp).toMillis()) {
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Refresh token expired",
    });
    return;
  }

  // Validate client if confidential
  if (clientId && clientSecret) {
    const clientSnap = await db()
      .collection("oauth_clients")
      .doc(td.clientId as string)
      .get();
    if (!clientSnap.exists) {
      res.status(401).json({ error: "invalid_client" });
      return;
    }
    const clientData = clientSnap.data()!;
    if (
      clientData.applicationType === "confidential" &&
      (clientId !== td.clientId ||
        sha256hex(clientSecret) !== clientData.clientSecretHash)
    ) {
      res.status(401).json({ error: "invalid_client" });
      return;
    }
  }

  // Rotate: mark old token consumed, issue new pair
  const { accessToken, jti: newJti } = await mintAccessToken(
    {
      sub: td.userId as string,
      scope: td.scope as string,
      orgId: td.orgId as string,
      patientId: td.patientId as string,
      clientId: td.clientId as string,
    },
    keys
  );

  const newRefreshToken = await issueRefreshToken({
    linkedJti: newJti,
    clientId: td.clientId as string,
    orgId: td.orgId as string,
    userId: td.userId as string,
    patientId: td.patientId as string,
    scope: td.scope as string,
  });

  // Mark old refresh token rotated
  await db()
    .collection("oauth_refresh_tokens")
    .doc(tokenHash)
    .update({ rotatedAt: FieldValue.serverTimestamp() });

  res.json({
    access_token: accessToken,
    refresh_token: newRefreshToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    scope: td.scope,
    patient: (td.patientId as string) || undefined,
  });
}

// ─── POST /auth/token/introspect ───────────────────────────────────────────────

async function handleIntrospect(req: ApiRequest, res: Response): Promise<void> {
  const { token } = req.body as Record<string, string>;

  if (!token) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  const payload = decodeJwtPayload(token);
  if (!payload?.jti) {
    res.json({ active: false });
    return;
  }

  const jti = payload.jti as string;
  const tokenSnap = await db()
    .collection("oauth_access_tokens")
    .doc(jti)
    .get();

  if (!tokenSnap.exists || tokenSnap.data()?.revokedAt) {
    res.json({ active: false });
    return;
  }

  const exp = (payload.exp as number) ?? 0;
  if (Math.floor(Date.now() / 1000) > exp) {
    res.json({ active: false });
    return;
  }

  res.json({
    active: true,
    sub: payload.sub,
    scope: payload.scope,
    client_id: tokenSnap.data()?.clientId,
    patient: payload.patient ?? undefined,
    org_id: payload.org_id,
    iat: payload.iat,
    exp: payload.exp,
    iss: payload.iss,
    jti,
  });
}

// ─── Token Minting Helpers ────────────────────────────────────────────────────

async function mintAccessToken(
  params: {
    sub: string;
    scope: string;
    orgId: string;
    patientId: string;
    clientId: string;
    extra?: Record<string, unknown>;
  },
  keys: KeyStore
): Promise<{ accessToken: string; jti: string; now: number }> {
  const jti = generateToken(16);
  const now = Math.floor(Date.now() / 1000);

  const payload: Record<string, unknown> = {
    iss: "https://maak.health",
    sub: params.sub,
    aud: "https://maak.health/fhir/r4",
    jti,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL,
    scope: params.scope,
    org_id: params.orgId,
    ...(params.patientId ? { patient: params.patientId } : {}),
    ...(params.extra ?? {}),
  };

  const accessToken = signJwt(payload, keys.privateKeyPem);

  await db()
    .collection("oauth_access_tokens")
    .doc(jti)
    .set({
      jti,
      clientId: params.clientId,
      orgId: params.orgId,
      userId: params.sub,
      patientId: params.patientId || null,
      scope: params.scope,
      issuedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis((now + ACCESS_TOKEN_TTL) * 1000),
      revokedAt: null,
    });

  return { accessToken, jti, now };
}

async function issueRefreshToken(params: {
  linkedJti: string;
  clientId: string;
  orgId: string;
  userId: string;
  patientId: string;
  scope: string;
}): Promise<string> {
  const token = generateToken(40);
  const tokenHash = sha256hex(token);

  await db()
    .collection("oauth_refresh_tokens")
    .doc(tokenHash)
    .set({
      tokenHash,
      ...params,
      issuedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + REFRESH_TOKEN_TTL * 1000),
      rotatedAt: null,
    });

  return token;
}

function buildIdToken(
  userId: string,
  patientId: string,
  now: number,
  keys: KeyStore
): string {
  return signJwt(
    {
      iss: "https://maak.health",
      sub: userId,
      aud: "maak-smart-client",
      iat: now,
      exp: now + ACCESS_TOKEN_TTL,
      ...(patientId ? { fhirUser: `Patient/${patientId}` } : {}),
    },
    keys.privateKeyPem
  );
}

// ─── Cloud Function ────────────────────────────────────────────────────────────

/**
 * SMART on FHIR Authorization Server.
 *
 * Deploy URL:
 *   https://<region>-<project>.cloudfunctions.net/smartAuth/...
 *
 * With Firebase Hosting rewrites (recommended for production):
 *   /auth/**               → smartAuth
 *   /.well-known/jwks.json → smartAuth
 */
export const smartAuth = functions.https.onRequest(async (rawReq, res) => {
  const req = rawReq as ApiRequest;
  const traceId = createTraceId();

  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const route = parseRoute(req.path);

  logger.info("SMART auth request", {
    traceId,
    method: req.method,
    path: req.path,
    route: route?.route ?? "unknown",
    fn: "smartAuth",
  });

  if (!route) {
    res.status(404).json({
      error: "not_found",
      availableRoutes: [
        "GET  /.well-known/jwks.json",
        "POST /auth/register",
        "GET  /auth/authorize",
        "POST /auth/authorize",
        "POST /auth/token",
        "POST /auth/token/introspect",
      ],
    });
    return;
  }

  try {
    switch (route.route) {
      case "jwks":
        if (req.method !== "GET") {
          res.status(405).json({ error: "method_not_allowed" });
          return;
        }
        await handleJwks(res);
        break;

      case "register":
        if (req.method !== "POST") {
          res.status(405).json({ error: "method_not_allowed" });
          return;
        }
        await handleRegister(req, res);
        break;

      case "authorize":
        if (req.method === "GET") {
          await handleAuthorizeGet(req, res);
        } else if (req.method === "POST") {
          await handleAuthorizePost(req, res);
        } else {
          res.status(405).json({ error: "method_not_allowed" });
        }
        break;

      case "token":
        if (req.method !== "POST") {
          res.status(405).json({ error: "method_not_allowed" });
          return;
        }
        await handleToken(req, res);
        break;

      case "introspect":
        if (req.method !== "POST") {
          res.status(405).json({ error: "method_not_allowed" });
          return;
        }
        await handleIntrospect(req, res);
        break;

      default:
        res.status(404).json({ error: "not_found" });
    }
  } catch (err) {
    logger.error("SMART auth handler error", err as Error, {
      traceId,
      path: req.path,
      fn: "smartAuth",
    });
    res.status(500).json({ error: "server_error" });
  }
});
