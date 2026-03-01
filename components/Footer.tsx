import { createClient } from "@/utils/supabase/server"
import { SubscribeButton } from './SubscribeButton'


export default async function Footer() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    const { data: profile } = user ? await supabase
        .from('user_profiles')
        .select('newsletter_subscriber')
        .eq('user_id', user.id)
        .single() : { data: null }

    const isSubscriber = profile?.newsletter_subscriber || false

    return (
        <div className="lg:ml-[60px]">
            <div className="border-y mt-12">
            <iframe 
          src="https://embeds.beehiiv.com/9d493c10-b8b3-41a9-9e8a-1d5767d98d81" 
          data-test-id="beehiiv-embed" 
          width="100%" 
          height="320" 
          className="dark:bg-gray-950 bg-white"
        />
            </div>
        <div className="text-sm p-4 mt-12 flex gap-4">
            <p className="">&copy; 2026. Made in Manchester by <a href="https://www.kevan.tv" className="hover:underline">Matt Kevan</a>.</p>
            <p className="text-gray-400"><a href="/privacy" className="hover:underline">Privacy</a></p>
            <p className="text-gray-400"><a href="/cookies" className="hover:underline">Cookies</a></p>

            <p className="text-gray-400"><a href="mailto:hello@uxlift.org" className="hover:underline">Contact</a></p>
        </div>
        </div>
    )
}

