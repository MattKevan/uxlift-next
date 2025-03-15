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
    const githubToken = process.env.GITHUB_PAT;
    const owner = process.env.GITHUB_REPO_OWNER;
    const repo = process.env.GITHUB_REPO_NAME;
    
    if (!githubToken || !owner || !repo) {
      return NextResponse.json(
        { error: 'GitHub credentials not configured' }, 
        { status: 500 }
      );
    }

    const dispatchRequest: GitHubDispatchRequest = {
      event_type: 'manual_trigger',
      client_payload: {
        process_type
      }
    };

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dispatchRequest)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', response.status, errorText);
      
      // Update job status to failed
      await supabase
        .from('feed_processing_jobs')
        .update({ 
          status: 'failed',
          error: `GitHub API error: ${response.status} - ${errorText}`
        })
        .eq('id', job.id);
      
      return NextResponse.json(
        { error: 'Failed to trigger GitHub workflow', details: errorText }, 
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
          process_type
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