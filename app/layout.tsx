import Link from "next/link"
import "./globals.css"
import localFont from 'next/font/local'
import Header from "@/components/Header"

import { Inter } from "next/font/google"
import PrelineScript from "@/components/PrelineScript"
import Footer from "@/components/Footer"

const mona = localFont({
  src: [
    {
      path: './fonts/MonaSans-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/MonaSans-Bold.woff2',
      weight: '800',
      style: 'normal',
    },
   
  ],
  variable: '--font-mona',
})

const monaCondensed = localFont({
  src: [
    {
      path: './fonts/MonaSansCondensed-Bold.woff2',
      weight: '800',
      style: 'normal',
    },
   
  ],
  variable: '--font-mona-condensed',
})
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
      <body className={`bg-background text-foreground  ${inter.variable} font-sans`}>
        
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
      </body>

    </html>
  )
}
