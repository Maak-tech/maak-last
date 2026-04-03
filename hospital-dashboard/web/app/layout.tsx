import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nuralix Hospital Dashboard',
  description: 'Hospital staff digital twin retrieval system',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen">{children}</body>
    </html>
  )
}
