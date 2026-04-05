import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // X-Frame-Options is the legacy way to block framing; CSP frame-ancestors
          // is the modern equivalent and takes precedence in supporting browsers.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // frame-ancestors 'none' prevents clickjacking in modern browsers
          // (CSP level 2+), complementing the legacy X-Frame-Options above.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          // Restrict powerful features: camera only on dashboard/enroll pages.
          // Microphone and geolocation are not needed anywhere in this app.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // Allow camera only on the pages that actually need it.
      {
        source: '/dashboard(.*)',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/enroll(.*)',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
