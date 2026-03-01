// app/api/trigger-github-action/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// Types for the request body
interface TriggerRequest {
  process_type: 'feeds' | 'embed' | 'both';
}

// GitHub API types
interface GitHubDispatchRequest {
  event_type: string;
  client_payload: {
    process_type: string;
  };
}

interface GitHubTokenCandidate {
  source: string;
  token: string;
}

interface GitHubDispatchAttempt {
  source: string;
  authScheme: 'token' | 'Bearer';
  tokenLength: number;
  status: number;
  details: string;
}

function truncateDetails(details: string, maxLength = 300): string {
  if (details.length <= maxLength) return details;
  return `${details.slice(0, maxLength)}...`;
}

function normalizeToken(value: string | undefined): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function getGitHubTokenCandidates(): GitHubTokenCandidate[] {
  const candidates: GitHubTokenCandidate[] = [
    { source: 'GITHUB_PAT', token: normalizeToken(process.env.GITHUB_PAT) },
    { source: 'GITHUB_WORKFLOW_TOKEN', token: normalizeToken(process.env.GITHUB_WORKFLOW_TOKEN) },
    { source: 'GITHUB_TOKEN', token: normalizeToken(process.env.GITHUB_TOKEN) },
    { source: 'GH_TOKEN', token: normalizeToken(process.env.GH_TOKEN) },
  ].filter((candidate) => candidate.token.length > 0);

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.token)) return false;
    seen.add(candidate.token);
    return true;
  });
}

async function dispatchWithAnyGitHubToken(params: {
  owner: string;
  repo: string;
  dispatchRequest: GitHubDispatchRequest;
  tokenCandidates: GitHubTokenCandidate[];
}) {
  const { owner, repo, dispatchRequest, tokenCandidates } = params;
  const attempts: GitHubDispatchAttempt[] = [];
  const authSchemes: Array<'token' | 'Bearer'> = ['token', 'Bearer'];

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
      );

      if (response.ok) {
        return {
          ok: true as const,
          source: `${candidate.source}/${authScheme}`,
        };
      }

      const details = truncateDetails(await response.text());
      attempts.push({
        source: candidate.source,
        authScheme,
        tokenLength: candidate.token.length,
        status: response.status,
        details,
      });
    }
  }

  return {
    ok: false as const,
    attempts,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user and check permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in to perform this action' }, 
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (profileError || !userProfile || !userProfile.is_admin) {
      console.error('Permission error - Not admin');
      return NextResponse.json(
        { error: 'Permission denied - Admin access required' }, 
        { status: 403 }
      );
    }

    // Parse request body
    const { process_type = 'feeds' } = await request.json() as TriggerRequest;
    
    // Validate process type
    if (!['feeds', 'embed', 'both'].includes(process_type)) {
      return NextResponse.json(
        { error: 'Invalid process type. Must be "feeds", "embed", or "both"' }, 
        { status: 400 }
      );
    }

    // Create a job record
    const { data: job, error: jobError } = await supabase
      .from('feed_processing_jobs')
      .insert([{ 
        status: 'pending',
        created_by: user.id,
        is_cron: false,
        job_type: process_type === 'both' ? 'full_processing' : process_type === 'feeds' ? 'feed_processing' : 'embedding'
      }])
      .select()
      .single();
    
    if (jobError) {
      console.error('Job creation error:', jobError);
      return NextResponse.json(
        { error: 'Failed to create job record' }, 
        { status: 500 }
      );
    }

    // Trigger GitHub Action
    const owner = (process.env.GITHUB_REPO_OWNER || '').trim();
    const repo = (process.env.GITHUB_REPO_NAME || '').trim();
    const tokenCandidates = getGitHubTokenCandidates();
    
    if (!owner || !repo || tokenCandidates.length === 0) {
      return NextResponse.json(
        {
          error: 'GitHub credentials not configured',
          details: `owner_set=${Boolean(owner)} repo_set=${Boolean(repo)} token_candidates=${tokenCandidates.length}`,
        }, 
        { status: 500 }
      );
    }

    const dispatchRequest: GitHubDispatchRequest = {
      event_type: 'manual_trigger',
      client_payload: {
        process_type
      }
    };

    const dispatchResult = await dispatchWithAnyGitHubToken({
      owner,
      repo,
      dispatchRequest,
      tokenCandidates,
    });

    if (!dispatchResult.ok) {
      const details = dispatchResult.attempts
        .map((attempt) => `${attempt.source}/${attempt.authScheme}(len=${attempt.tokenLength}):${attempt.status}:${attempt.details}`)
        .join(' | ');

      console.error('GitHub API error:', details);
      
      // Update job status to failed
      await supabase
        .from('feed_processing_jobs')
        .update({ 
          status: 'failed',
          error: `GitHub API error: ${details}`
        })
        .eq('id', job.id);
      
      return NextResponse.json(
        { error: 'Failed to trigger GitHub workflow', details }, 
        { status: 500 }
      );
    }

    // Update job status to initiated
    await supabase
      .from('feed_processing_jobs')
      .update({ 
        status: 'initiated',
        metadata: {
          github_workflow: 'process-content',
          process_type,
          token_source: dispatchResult.source,
        }
      })
      .eq('id', job.id);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `${process_type} processing initiated via GitHub Actions`
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
