import { SidebarItem } from '@/components/catalyst/sidebar'

interface MobileSidebarProps {
  onClose?: () => void
}

export default function MobileSidebar({ onClose }: MobileSidebarProps) {
  const handleItemClick = () => {
    // Close sidebar when a navigation item is clicked
    if (onClose) {
      onClose()
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <nav className=" ">
        {[
          { href: '/', label: 'Home' },
          { href: '/news', label: 'News' },
          { href: '/topics', label: 'Topics' },
          { href: '/tools', label: 'Tools' },
          { href: '/courses', label: 'Courses' },
          { href: '/newsletter', label: 'Newsletter' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className=" flex items-center px-5 py-4 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900 dark:text-gray-300 hover:text-gray-900 border-b"
            onClick={handleItemClick}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  )
}
