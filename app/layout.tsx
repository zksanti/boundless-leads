import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'Boundless Leads',
  description: 'Daily qualified outbound leads for Boundless',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gray-50 font-sans antialiased">
        <Nav />
        {children}
      </body>
    </html>
  )
}
