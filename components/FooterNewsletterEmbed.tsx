export function FooterNewsletterEmbed() {
  return (
    <div className="border-y mt-12">
      <iframe
        src="https://embeds.beehiiv.com/9d493c10-b8b3-41a9-9e8a-1d5767d98d81"
        data-test-id="beehiiv-embed"
        width="100%"
        height="320"
        title="Subscribe to the UX Lift newsletter"
        loading="lazy"
        className="dark:bg-gray-950 bg-white"
      />
    </div>
  )
}
