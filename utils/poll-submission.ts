type PollOptions = {
  intervalMs?: number
  timeoutMs?: number
}

/**
 * Poll the submission endpoint until the background GitHub Action has
 * processed the queued placeholder post.
 */
export async function pollSubmission(
  postId: number,
  { intervalMs = 3000, timeoutMs = 120000 }: PollOptions = {},
) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(
      `/api/fetch-url?postId=${encodeURIComponent(String(postId))}`,
      { cache: 'no-store' },
    )

    const data = await response.json().catch(() => null)

    if (response.ok && data?.post) {
      return data.post as any
    }

    if (response.status === 202) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      continue
    }

    if (response.status === 401) {
      throw new Error('Please sign in again to check this submission.')
    }

    if (!response.ok) {
      throw new Error(
        (data && typeof data.error === 'string' && data.error) ||
          'Content processing failed. Please try again.',
      )
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(
    'Processing is taking longer than expected. Please check back shortly.',
  )
}
