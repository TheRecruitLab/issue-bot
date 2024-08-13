export async function getListOfPullRequests({ octokit, owner, repo, base, state = 'open' }) {
  const pullRequests = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    base: 'production',
    state,
    per_page: 100,
    sort: 'created',
    direction: 'desc',
  });

  return pullRequests.data.map(({ base, head }) => ({ base, head }));
}
;
