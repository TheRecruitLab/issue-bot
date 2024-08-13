export async function getPullRequestCommits({ octokit, owner, repo, pull_number, page = 1 }) {
  const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', {
    owner,
    repo,
    pull_number,
    per_page: 100,
    page,
  });

  return response.data?.map((commit) => ({ message: commit?.commit?.message }));
}
