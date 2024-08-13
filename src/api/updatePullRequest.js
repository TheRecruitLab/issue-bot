export async function updatePullRequest({ octokit, owner, repo, pull_number, ...rest }) {
  const response = await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number,
    ...rest,
  });
}
