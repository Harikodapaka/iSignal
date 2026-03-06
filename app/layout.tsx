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
import { ThemeSwitcher } from '@/components/ThemeSwitcher'

export const metadata: Metadata = {
  title: 'iSignal — Your Health Signal',
  description: 'Track anything. Understand everything.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          <Providers>
            <Notifications position="top-center" zIndex={9999} />
            <div className="gradient-bg" />
            <div className="desktop-only" style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
              <ThemeSwitcher />
            </div>
            {children}
          </Providers>
        </MantineProvider>
      </body>
    </html>
  )
}
