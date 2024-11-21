import Link from "next/link"
import "./globals.css"
import Header from "@/components/Header"

import { Inter } from "next/font/google"
import Footer from "@/components/Footer"
import { Analytics } from "@vercel/analytics/react"
import { NotificationProvider } from '@/contexts/NotificationContext';
import Notification from '@/components/Notification';

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
    description: "The place to discover and share UX articles, news and resources.",
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

      <body className={`bg-background text-foreground  ${inter.variable} font-sans`}>
      <NotificationProvider>
      <Notification />

        <div className="relative isolate flex flex-col min-h-svh w-full">
          
          <div className=" w-[60px] fixed top-0 h-full max-lg:hidden md:border-r ">
            <Link href='/'>
              <img src="/uxlift-logo.svg" alt="UX Lift logo" className="size-6 mt-4 mx-auto" />
            </Link>
          </div>
          
          <Header/>

          <div className="flex-grow  lg:ml-[60px] pb-12">
            {children}
            <Footer/>
          </div>

        </div>
        </NotificationProvider>
        <Analytics/>
      </body>
    </html>
  )
}
