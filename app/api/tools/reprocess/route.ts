import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { reprocessTool } from '@/utils/tool-tools/fetch-tool-content'
import { reprocessToolRequestSchema, validateApiRequest } from '@/utils/validation'

interface GitHubDispatchRequest {
  event_type: string
  client_payload: {
    tool_id: number
    description?: string
  }
}

interface GitHubTokenCandidate {
  source: string
  token: string
}

interface GitHubDispatchAttempt {
  source: string
  authScheme: 'token' | 'Bearer'
  tokenLength: number
  status: number
  details: string
}

function truncateDetails(details: string, maxLength = 300): string {
  if (details.length <= maxLength) return details
  return `${details.slice(0, maxLength)}...`
}

function normalizeToken(value: string | undefined): string {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

function getGitHubTokenCandidates(): GitHubTokenCandidate[] {
  const candidates: GitHubTokenCandidate[] = [
    { source: 'GITHUB_PAT', token: normalizeToken(process.env.GITHUB_PAT) },
    { source: 'GITHUB_WORKFLOW_TOKEN', token: normalizeToken(process.env.GITHUB_WORKFLOW_TOKEN) },
    { source: 'GITHUB_TOKEN', token: normalizeToken(process.env.GITHUB_TOKEN) },
    { source: 'GH_TOKEN', token: normalizeToken(process.env.GH_TOKEN) },
  ].filter((candidate) => candidate.token.length > 0)

  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    if (seen.has(candidate.token)) return false
    seen.add(candidate.token)
    return true
  })
}

async function queueToolReprocess(params: {
  toolId: number
  description?: string
}) {
  const owner = (process.env.GITHUB_REPO_OWNER || '').trim()
  const repo = (process.env.GITHUB_REPO_NAME || '').trim()
  const tokenCandidates = getGitHubTokenCandidates()
  if (!owner || !repo || tokenCandidates.length === 0) {
    return {
      queued: false as const,
      reason: 'missing_github_config' as const,
      details: `owner_set=${Boolean(owner)} repo_set=${Boolean(repo)} token_candidates=${tokenCandidates.length}`,
    }
  }

  const dispatchRequest: GitHubDispatchRequest = {
    event_type: 'tool_reprocess',
    client_payload: {
      tool_id: params.toolId,
      description: params.description?.trim() || undefined,
    },
  }

  const attempts: GitHubDispatchAttempt[] = []
  const authSchemes: Array<'token' | 'Bearer'> = ['token', 'Bearer']

  for (const candidate of tokenCandidates) {
    for (const authScheme of authSchemes) {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `${authScheme} ${candidate.token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dispatchRequest),
        }
      )

      if (response.ok) {
        return {
          queued: true as const,
          eventType: dispatchRequest.event_type,
          source: `${candidate.source}/${authScheme}`,
        }
      }

      attempts.push({
        source: candidate.source,
        authScheme,
        tokenLength: candidate.token.length,
        status: response.status,
        details: truncateDetails(await response.text()),
      })
    }
  }

  return {
    queued: false as const,
    reason: 'dispatch_failed' as const,
    attempts,
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, is_admin')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { toolId, description } = validateApiRequest(
      reprocessToolRequestSchema,
      body,
      '/api/tools/reprocess'
    )

    const queueResult = await queueToolReprocess({
      toolId,
      description,
    })

    if (queueResult.queued) {
      console.log('[tools reprocess] queued', {
        toolId,
        eventType: queueResult.eventType,
        tokenSource: queueResult.source,
      })

      return NextResponse.json(
        {
          success: true,
          queued: true,
          toolId,
          message: 'Tool reprocess queued in GitHub Actions',
        },
        { status: 202 }
      )
    }

    if (queueResult.reason === 'missing_github_config' && process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        {
          success: false,
          error: 'GitHub workflow configuration missing for tool reprocess',
          details: queueResult.details,
        },
        { status: 500 }
      )
    }

    if (queueResult.reason === 'dispatch_failed') {
      const details = queueResult.attempts
        .map((attempt) => `${attempt.source}/${attempt.authScheme}(len=${attempt.tokenLength}):${attempt.status}:${attempt.details}`)
        .join(' | ')
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to queue GitHub workflow',
          details,
        },
        { status: 500 }
      )
    }

    const updatedTool = await reprocessTool(toolId, supabase, {
      description,
    })

    console.log('[tools reprocess] completed', {
      toolId,
      title: updatedTool.title,
      queued: false,
    })

    return NextResponse.json({
      success: true,
      queued: false,
      tool: updatedTool,
    })
  } catch (error) {
    console.error('[tools reprocess] failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reprocess tool',
      },
      { status: 500 }
    )
  }
}
