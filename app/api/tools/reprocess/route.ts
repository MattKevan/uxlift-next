import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { reprocessTool } from '@/utils/tool-tools/fetch-tool-content'
import { reprocessToolRequestSchema, validateApiRequest } from '@/utils/validation'

async function queueToolReprocess(params: {
  toolId: number
  description?: string
}) {
  const githubToken = process.env.GITHUB_PAT
  const owner = process.env.GITHUB_REPO_OWNER
  const repo = process.env.GITHUB_REPO_NAME
  const workflowFile = process.env.GITHUB_TOOL_REPROCESS_WORKFLOW || 'reprocess-tool.yml'
  const workflowRef = process.env.GITHUB_WORKFLOW_REF || 'main'

  if (!githubToken || !owner || !repo) {
    return { queued: false as const, reason: 'missing_github_config' as const }
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: workflowRef,
        inputs: {
          tool_id: String(params.toolId),
          description: params.description?.trim() || '',
        },
      }),
    }
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Failed to queue GitHub workflow (${response.status}): ${details}`)
  }

  return { queued: true as const, workflowFile, workflowRef }
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
        workflowFile: queueResult.workflowFile,
        workflowRef: queueResult.workflowRef,
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
