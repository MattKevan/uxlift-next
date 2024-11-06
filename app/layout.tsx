import DeployButton from "@/components/deploy-button"
import { EnvVarWarning } from "@/components/env-var-warning"
import HeaderAuth from "@/components/header-auth"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { hasEnvVars } from "@/utils/supabase/check-env-vars"
import { GeistSans } from "geist/font/sans"
import { ThemeProvider } from "next-themes"
import Link from "next/link"
import "./globals.css"
import { Navbar } from '@/components/catalyst/navbar'
import { Sidebar } from '@/components/catalyst/sidebar'
import { StackedLayout } from '@/components/catalyst/stacked-layout'
import Header from "@/components/Header"
import { Gentium_Plus } from 'next/font/google'
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google"
import MobileSidebar from "@/components/Sidebar"

const gentiumPlus = Gentium_Plus({
  weight: '400',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--gentium-plus'
})

const plexSans = IBM_Plex_Sans({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--ibm-plex-sans'
})

const plexMono = IBM_Plex_Mono({
  weight: '400',
  subsets: ['latin'],
  style: ['normal'],
  display: 'swap',
  variable: '--ibm-plex-mono'
})

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000"

type Params = Promise<{ slug: string }>

export async function generateMetadata({ 
  params 
}: { 
  params: Params 
}) {
  const { slug } = await params
  return {
    metadataBase: new URL(defaultUrl),
    title: "UX Lift",
    description: "The fastest way to build apps with Next.js and Supabase",
  }
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Params
}) {
  const { slug } = await params

  return (
    <html>
      <body className={`bg-background text-foreground ${plexSans.variable} ${plexMono.variable} ${gentiumPlus.variable} font-serif`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <StackedLayout
            navbar={<Navbar>{<Header/>}</Navbar>}
            sidebar={<MobileSidebar />}
          >
            {children}
            <ThemeSwitcher />
          </StackedLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}
