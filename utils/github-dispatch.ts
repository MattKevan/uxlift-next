type DispatchPayload = Record<string, unknown>;

type TokenCandidate = {
  source: string;
  token: string;
};

function normalizeToken(value: string | undefined) {
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

function getRepoConfig() {
  const owner = process.env.GITHUB_REPO_OWNER?.trim();
  const repo = process.env.GITHUB_REPO_NAME?.trim();
  if (!owner || !repo) return null;
  return { owner, repo };
}

function getTokenCandidates(): TokenCandidate[] {
  const candidates = [
    { source: 'GITHUB_WORKFLOW_TOKEN', token: normalizeToken(process.env.GITHUB_WORKFLOW_TOKEN) },
    { source: 'GITHUB_PAT', token: normalizeToken(process.env.GITHUB_PAT) },
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

function githubHeaders(token: string, scheme: 'Bearer' | 'token' = 'Bearer') {
  return {
    Authorization: `${scheme} ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'uxlift-cloudflare',
  };
}

/**
 * Send a repository_dispatch event to GitHub Actions.
 *
 * Used by lightweight Worker routes to hand long-running content work to a
 * GitHub workflow instead of running it in the Worker.
 */
export async function dispatchRepositoryEvent(
  eventType: string,
  payload: DispatchPayload,
): Promise<void> {
  const config = getRepoConfig();
  const candidates = getTokenCandidates();

  if (!config || candidates.length === 0) {
    throw new Error('GitHub dispatch is not configured');
  }

  const attempts: string[] = [];

  for (const candidate of candidates) {
    for (const scheme of ['Bearer', 'token'] as const) {
      const response = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/dispatches`,
        {
          method: 'POST',
          headers: {
            ...githubHeaders(candidate.token, scheme),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: eventType,
            client_payload: payload,
          }),
        },
      );

      if (response.ok) return;

      attempts.push(`${candidate.source}/${scheme}:${response.status}`);
    }
  }

  throw new Error(`GitHub dispatch failed (${attempts.join(', ')})`);
}

/**
 * Check that a workflow exists on the default branch before creating a queued
 * placeholder. GitHub accepts repository_dispatch events for unknown event
 * types, so without this check a missing workflow would leave rows stuck.
 */
export async function isGitHubWorkflowAvailable(
  workflowFile: string,
): Promise<boolean> {
  const config = getRepoConfig();
  const candidates = getTokenCandidates();

  if (!config || candidates.length === 0) return false;

  for (const candidate of candidates) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(workflowFile)}`,
        { headers: githubHeaders(candidate.token) },
      );

      if (response.status === 404) return false;
      if (response.ok) return true;
    } catch {
      // Try the next candidate.
    }
  }

  return false;
}
