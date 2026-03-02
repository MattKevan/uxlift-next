import { FooterNewsletterEmbed } from './FooterNewsletterEmbed'

export default function Footer() {
    return (
        <div className="lg:ml-[60px]">
        <FooterNewsletterEmbed />
        <div className="text-sm p-4 mt-12 flex gap-4 flex-wrap">
            <p className="">&copy; 2026. Made in Manchester by <a href="https://www.kevan.tv" className="hover:underline">Matt Kevan</a>.</p>
            <p className="text-gray-600 dark:text-gray-300"><a href="/privacy" className="hover:underline">Privacy</a></p>
            <p className="text-gray-600 dark:text-gray-300"><a href="/cookies" className="hover:underline">Cookies</a></p>

            <p className="text-gray-600 dark:text-gray-300"><a href="mailto:hello@uxlift.org" className="hover:underline">Contact</a></p>
        </div>
        <script data-goatcounter="https://uxlift.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
        </div>
    )
}
