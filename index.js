  const github = require('@actions/github');
  const core = require('@actions/core');
  const { graphql } = require("@octokit/graphql");

  async function run() {
    const githubToken = core.getInput('github_token');
    const state = core.getInput('state');

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
            }
            state,
            id,
            number,
            closingIssuesReferences(first: 100) { 
              nodes { 
                number 
              },
              totalCount,
            } 
          }
        }
      }
    `);

    const linkedIssues = repository?.pullRequest?.closingIssuesReferences?.nodes || [];

    for (const linkedIssue of linkedIssues) {
      const { data: issue } = await octokit.rest.issues.update({
        reop,
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