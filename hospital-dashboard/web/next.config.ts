import type { NextConfig } from 'next'

// The hospital API origin that the browser is allowed to connect to.
// Falls back to localhost for local development.
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Content-Security-Policy ────────────────────────────────────────────────────
// Restricts every resource type to 'self' (this origin) plus the explicit
// hospital API endpoint.  This limits the blast radius of a stored-XSS attack
// — an injected script cannot exfiltrate PHI to an attacker-controlled server
// because connect-src only allows the known API origin.
//
// Caveats (documented so they can be tightened later):
// • script-src 'unsafe-inline' — required by Next.js hydration scripts.
//   Eliminate by generating a per-request nonce in middleware.ts and passing
//   it through <Html nonce={nonce}> in _document.tsx.
// • style-src 'unsafe-inline' — required by Tailwind CSS class injection.
//   Eliminate by moving to a build-time stylesheet + nonce approach.
// • connect-src wss: — allows WebSocket upgrades to any WSS host; narrow to
//   the specific WebSocket origin once the WS endpoint URL is finalised.
const buildCsp = (allowCamera: boolean): string => [
  "default-src 'self'",
  // unsafe-inline is needed for Next.js hydration; acceptable until nonces are added
  "script-src 'self' 'unsafe-inline'",
  // unsafe-inline is needed for Tailwind runtime styles
  "style-src 'self' 'unsafe-inline'",
  // API calls + WebSocket upgrades; wss: allows upgrade without knowing the exact WS hostname
  `connect-src 'self' ${API_ORIGIN} wss:`,
  // blob: is required for canvas snapshots (CameraCapture) and QR image processing
  "img-src 'self' data: blob:",
  // blob: is required for getUserMedia() webcam stream URLs
  `media-src 'self' blob:${allowCamera ? ' mediastream:' : ''}`,
  // blob: is required for jsQR / QR scanner web worker
  "worker-src 'self' blob:",
  "font-src 'self'",
  // Disallow Flash, Java applets, and all other plugins
  "object-src 'none'",
  // Prevent <base href="https://attacker.com"> tag injection
  "base-uri 'self'",
  // Prevent credential-bearing forms from being submitted to external sites
  "form-action 'self'",
  // Clickjacking protection (CSP level 2+ — takes precedence over X-Frame-Options)
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  async headers() {
    return [
      // ── Global headers (all routes) ──────────────────────────────────────────
      {
        source: '/(.*)',
        headers: [
          // Force HTTPS for 1 year; include subdomains so staff can't be
          // downgraded to HTTP on any subdomain of the hospital domain.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // X-Frame-Options is the legacy clickjacking guard for browsers that
          // pre-date CSP level 2 frame-ancestors; keep it for belt-and-suspenders.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME-type sniffing — important when staff upload files.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Omit the full referrer on cross-origin requests so the hospital's
          // internal URL structure is not leaked to third parties.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Full CSP (no camera) for all pages; overridden below for camera pages.
          { key: 'Content-Security-Policy', value: buildCsp(false) },
          // Default: deny camera, microphone, and geolocation everywhere.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // ── Dashboard: camera required for face recognition ──────────────────────
      {
        source: '/dashboard(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: buildCsp(true) },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
      // ── Enroll: camera required for face capture ─────────────────────────────
      {
        source: '/enroll(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: buildCsp(true) },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
