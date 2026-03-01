const SPACED_SEPARATOR_PATTERN = /\s(?:\||–|—|-|:|·|•)\s/
const PIPE_PATTERN = /\|/

function getDelimiterIndex(title: string): number {
  const spacedMatch = title.match(SPACED_SEPARATOR_PATTERN)
  const pipeMatch = title.match(PIPE_PATTERN)

  const candidateIndexes = [spacedMatch?.index, pipeMatch?.index]
    .filter((index): index is number => typeof index === 'number' && index > 0)

  if (candidateIndexes.length === 0) {
    return -1
  }

  return Math.min(...candidateIndexes)
}

export function sanitizeToolTitle(rawTitle: string | null | undefined, fallback = ''): string {
  const normalized = (rawTitle || '').replace(/\s+/g, ' ').trim()
  const fallbackNormalized = fallback.replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return fallbackNormalized
  }

  const delimiterIndex = getDelimiterIndex(normalized)
  if (delimiterIndex < 0) {
    return normalized
  }

  const trimmedTitle = normalized
    .slice(0, delimiterIndex)
    .replace(/[|:•·\-–—\s]+$/g, '')
    .trim()

  return trimmedTitle || fallbackNormalized || normalized
}
