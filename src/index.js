  const github = require('@actions/github');
  const core = require('@actions/core');
  const { graphql } = require("@octokit/graphql");

  async function run() {
    const githubToken = core.getInput('github_token');
    const state = core.getInput('state');
    const requiresMerge = core.getInput('requires_merge');

    const octokit = github.getOctokit(githubToken)
    const context = github.context;

    const owner = context.payload?.repository?.owner?.login;
    const repo = context.payload?.repository?.name;

    const graphqlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${githubToken}`,
      },
    });

    if (! context?.payload?.pull_request) {
        throw new Error('Invalid Github event. Must be a pull_request event.');
    }

    const { repository } = await graphqlWithAuth(`
      {
        repository(owner: "${owner}", name: "${repo}") {
          pullRequest(number: ${context.payload.pull_request.number}) {
            author {
              login
            },
            closingIssuesReferences(first: 100) { 
              nodes { 
                number 
              },
              totalCount,
            },
            id,
            merged,
            number,
            state,
          }
        }
      }
    `);

    if (requiresMerge && ! repository?.pullRequest?.merged) {
      console.log('The Pull Request must be merged in order to update associated issues.', { requiresMerge });
      
      return;
    }

    const linkedIssues = repository?.pullRequest?.closingIssuesReferences?.nodes || [];

    for (const linkedIssue of linkedIssues) {
      const { data: issue } = await octokit.rest.issues.update({
        repo,
        owner,
        issue_number: linkedIssue.number,
        state,
      });

      if (! issue) {
        throw new Error('An issue attached to the Pull Request could not be found.');
      }

      console.log(`#${linkedIssue.number} was changed to ${issue.state}`);
    }
}

run();