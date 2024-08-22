import { capitalize } from "./handle-branch-prs";

export async function createPullRequest({ octokit, owner, repo, base, head }) {
  const response = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    title: `${capitalize(head)} -> ${capitalize(base)}`,
    body: '',
    head,
    base,
  });

  return response.data;
}
