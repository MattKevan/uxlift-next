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

const gentiumPlus = Gentium_Plus({
  weight: '400',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
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
    <html className={`${GeistSans.variable} ${gentiumPlus.className}`}>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <StackedLayout
            navbar={<Navbar>{<Header/>}</Navbar>}
            sidebar={<Sidebar>{/* Your sidebar content */}</Sidebar>}
          >
            {children}
            <ThemeSwitcher />
          </StackedLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}
