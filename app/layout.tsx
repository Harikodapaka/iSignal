import type { Metadata } from 'next'
import { ColorSchemeScript, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/charts/styles.css'
import '@mantine/dates/styles.css'
import './globals.css'
import { theme } from './theme'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'iSignal — Your Health Signal',
  description: 'Track anything. Understand everything.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="dark">
          <Providers>
            <Notifications position="top-center" zIndex={9999} />
            <div className="gradient-bg" />
            {children}
          </Providers>
        </MantineProvider>
      </body>
    </html>
  )
}
