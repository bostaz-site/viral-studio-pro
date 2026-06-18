/**
 * Push files to GitHub via the Contents API.
 * Works in Railway containers where .git folder is not available.
 *
 * Requires GITHUB_TOKEN env var with `repo` scope.
 */

const OWNER = 'bostaz-site'
const REPO = 'viral-studio-pro'

/**
 * Push a single file to GitHub via the Contents API.
 * Creates or updates the file. Returns the HTML URL of the file on GitHub.
 */
export async function pushFileToGitHub(
  filepath: string,
  content: string,
  message: string,
): Promise<string> {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('GITHUB_TOKEN not set — cannot push to GitHub')
  }

  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filepath}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }

  // Check if file exists to get its SHA (required for updates)
  let sha: string | undefined
  try {
    const checkRes = await fetch(apiUrl, { headers })
    if (checkRes.ok) {
      const data = await checkRes.json()
      sha = data.sha
    }
  } catch {
    // File doesn't exist yet, that's fine
  }

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString('base64'),
      ...(sha ? { sha } : {}),
      branch: 'master',
      committer: { name: 'Audit Agent', email: 'audit@viralanimal.com' },
    }),
  })

  if (!putRes.ok) {
    const err = await putRes.text()
    throw new Error(`GitHub Contents API failed (${putRes.status}): ${err}`)
  }

  const result = await putRes.json()
  return result.content?.html_url ?? `https://github.com/${OWNER}/${REPO}/blob/master/${filepath}`
}
