import Link from 'next/link'

interface TagProps {
  href: string
  text: string
}

export function Tag({ href, text }: TagProps) {
  return (
    <Link 
      href={href}
      className="border px-3 py-1 rounded-full text-sm text-gray-600 hover:bg-gray-200"

    >
      {text}
    </Link>
  )
}

interface TagsListProps {
  tags: { href: string; text: string }[]
}

export function TagsList({ tags }: TagsListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <Tag key={tag.text} {...tag} />
      ))}
    </div>
  )
}