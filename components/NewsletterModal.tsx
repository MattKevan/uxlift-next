import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface NewsletterModalProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

export function NewsletterModal({ isOpen, setIsOpen }: NewsletterModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Newsletter signup</DialogTitle>
          <DialogDescription>Subscribe to the UX Lift newsletter.</DialogDescription>
        </DialogHeader>
        <div>
        <iframe 
          src="https://embeds.beehiiv.com/9d493c10-b8b3-41a9-9e8a-1d5767d98d81" 
          data-test-id="beehiiv-embed" 
          width="100%" 
          height="320" 
          className="dark:bg-gray-950 bg-white"
        />
      </div>
      </DialogContent>
    </Dialog>
  )
}
