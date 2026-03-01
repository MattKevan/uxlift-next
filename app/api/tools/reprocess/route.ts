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

async function queueToolReprocess(params: {
  toolId: number
  description?: string
}) {
  const githubToken = (
    process.env.GITHUB_WORKFLOW_TOKEN ||
    process.env.GITHUB_PAT ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    ''
  ).trim()
  const owner = (process.env.GITHUB_REPO_OWNER || '').trim()
  const repo = (process.env.GITHUB_REPO_NAME || '').trim()
  if (!githubToken || !owner || !repo) {
    return { queued: false as const, reason: 'missing_github_config' as const }
  }

  const dispatchRequest: GitHubDispatchRequest = {
    event_type: 'tool_reprocess',
    client_payload: {
      tool_id: params.toolId,
      description: params.description?.trim() || undefined,
    },
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dispatchRequest),
    }
  )

  if (!response.ok) {
    const details = await response.text()
    if (response.status === 401) {
      throw new Error(
        'Failed to queue GitHub workflow (401). Check token validity and set GITHUB_WORKFLOW_TOKEN/GITHUB_PAT in your host env.'
      )
    }

    throw new Error(`Failed to queue GitHub workflow (${response.status}): ${details}`)
  }

  return { queued: true as const, eventType: dispatchRequest.event_type }
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
