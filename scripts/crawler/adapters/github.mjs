import { GITHUB_REPOS, fetchWithTimeout } from "../config.mjs";
import { cleanDisplayName, toIsoDate } from "../lib/normalizer.mjs";

/**
 * Crawl official GitHub repository releases for open-weight flagship releases.
 */
export async function crawlGitHubReleases({
  fetchFn = globalThis.fetch,
  repos = GITHUB_REPOS,
  token = process.env.GITHUB_TOKEN || "",
} = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const results = await Promise.allSettled(
    repos.map(async ({ repo, orgId }) => {
      const apiUrl = `https://api.github.com/repos/${repo}/releases?per_page=10`;
      const resp = await fetchWithTimeout(apiUrl, { headers }, fetchFn);
      if (!resp.ok) {
        throw new Error(`${repo}: HTTP ${resp.status}`);
      }
      const releases = await resp.json();
      if (!Array.isArray(releases)) {
        throw new Error(`${repo}: invalid JSON array`);
      }

      const items = [];
      for (const rel of releases) {
        if (rel?.draft || rel?.prerelease) continue;
        const dateObj = toIsoDate(rel?.published_at || rel?.created_at);
        if (!dateObj) continue;

        const rawTitle = rel?.name || rel?.tag_name || "";
        const name = cleanDisplayName(rawTitle);
        if (!name) continue;

        items.push({
          orgId,
          name,
          releaseDate: dateObj.releaseDate,
          releaseMonth: dateObj.releaseMonth,
          description: String(rel?.body || "").slice(0, 400),
          modality: "",
          contextTokens: null,
          openWeights: true,
          officialUrl: rel?.html_url || `https://github.com/${repo}/releases`,
          sourceType: "github",
          discoveredFrom: `GitHub (${repo})`,
        });
      }
      return { fetchedCount: releases.length, items };
    }),
  );

  const candidates = [];
  const errors = [];
  let fetchedCount = 0;
  let successRepos = 0;

  for (const res of results) {
    if (res.status === "fulfilled") {
      successRepos += 1;
      fetchedCount += res.value.fetchedCount;
      candidates.push(...res.value.items);
    } else {
      errors.push(res.reason instanceof Error ? res.reason.message : String(res.reason));
    }
  }

  return {
    source: "github",
    ok: successRepos > 0,
    fetchedCount,
    candidates,
    ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
  };
}
