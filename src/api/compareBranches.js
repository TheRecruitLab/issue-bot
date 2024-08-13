export async function compareBranches({ octokit, owner, repo, base, head }) {
  const response = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
    owner,
    repo,
    basehead: `${base}...${head}`,
  });

  return response.data;
}
;
