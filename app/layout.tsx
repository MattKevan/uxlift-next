import { ThemeProvider } from "next-themes"
import Link from "next/link"
import "./globals.css"

import Header from "@/components/Header"

import { Inter } from "next/font/google"

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
      <body className={`bg-background text-foreground ${inter.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative isolate flex min-h-svh w-full">
            <div className=" w-[60px] fixed top-0 h-full max-lg:hidden">
              <Link href='/'>
                <img src="/uxlift-logo.svg" alt="UX Lift logo" className="size-6 mt-4 mx-auto" />
              </Link>
            </div>
          <div className="flex-grow md:border-l lg:ml-[60px] pb-12">
            <Header/>

            {children}

          

          </div>


          </div>
          
        </ThemeProvider>
      </body>
    </html>
  )
}
