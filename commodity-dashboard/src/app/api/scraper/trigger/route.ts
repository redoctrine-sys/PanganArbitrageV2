import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/scraper/trigger
 *
 * Triggers a GitHub Actions workflow_dispatch to run the PIHPS scraper.
 * Requires GITHUB_PAT (Personal Access Token with `repo` or `actions:write` scope)
 * set in environment variables.
 *
 * Body: { agent: "pihps" | "paskomnas" }
 */

const GITHUB_OWNER = "redoctrine-sys";
const GITHUB_REPO = "PanganArbitrageV2";
const WORKFLOW_FILE = "scrape.yml";
const DEFAULT_BRANCH = "main";

export async function POST(req: Request): Promise<NextResponse> {
  const githubPat = process.env.GITHUB_PAT;

  if (!githubPat) {
    return NextResponse.json(
      {
        error: "GITHUB_PAT not configured",
        hint: "Set GITHUB_PAT environment variable with a GitHub Personal Access Token (repo scope)",
      },
      { status: 500 }
    );
  }

  let body: { agent?: string };
  try {
    body = await req.json();
  } catch {
    body = { agent: "pihps" };
  }

  const agent = body.agent ?? "pihps";

  if (!["pihps", "paskomnas"].includes(agent)) {
    return NextResponse.json(
      { error: `Invalid agent: ${agent}. Must be 'pihps' or 'paskomnas'` },
      { status: 400 }
    );
  }

  try {
    // GitHub API: Create a workflow dispatch event
    // https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubPat}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: DEFAULT_BRANCH,
        inputs: {
          agent,
        },
      }),
    });

    if (response.status === 204) {
      // Success — GitHub returns 204 No Content on successful dispatch
      return NextResponse.json({
        success: true,
        message: `Scraper '${agent}' triggered successfully. Check GitHub Actions for progress.`,
        agent,
        workflow: WORKFLOW_FILE,
        timestamp: new Date().toISOString(),
      });
    }

    // Error
    const errorText = await response.text();
    return NextResponse.json(
      {
        error: `GitHub API returned ${response.status}`,
        details: errorText,
        hint: response.status === 404
          ? "Workflow file not found, or GITHUB_PAT lacks 'actions:write' permission"
          : response.status === 422
          ? "Workflow may not have workflow_dispatch trigger, or branch doesn't exist"
          : undefined,
      },
      { status: response.status }
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to trigger: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scraper/trigger
 *
 * Returns recent workflow runs for the scraper
 */
export async function GET(): Promise<NextResponse> {
  const githubPat = process.env.GITHUB_PAT;

  if (!githubPat) {
    return NextResponse.json({ runs: [], configured: false });
  }

  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=5`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${githubPat}`,
        Accept: "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: 30 }, // cache for 30s
    });

    if (!response.ok) {
      return NextResponse.json({ runs: [], configured: true, error: `GitHub ${response.status}` });
    }

    const data = await response.json();
    const runs = (data.workflow_runs ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      status: r.status,           // "queued" | "in_progress" | "completed"
      conclusion: r.conclusion,   // "success" | "failure" | "cancelled" | null
      created_at: r.created_at,
      updated_at: r.updated_at,
      html_url: r.html_url,
      run_number: r.run_number,
      event: r.event,             // "schedule" | "workflow_dispatch"
    }));

    return NextResponse.json({ runs, configured: true });
  } catch (err) {
    return NextResponse.json({
      runs: [],
      configured: true,
      error: (err as Error).message,
    });
  }
}
