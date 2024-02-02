const github = require('@actions/github');
const core = require('@actions/core');
const { graphql } = require("@octokit/graphql");

async function run() {
    const githubToken = core.getInput('github_token');
    const state = core.getInput('state');

    const octokit = github.getOctokit(githubToken)
    const context = github.context;

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
        repository(owner: "${context.payload?.repository?.owner?.login}", name: "${context.payload?.repository?.name}") {
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

console.log({
  PR: repository.pullRequest,
  closing: repository.pullRequest.closingIssuesReferences.nodes[0],
});

    // if (! pullRequest) {
    //   throw new Error('Pull Request could not be found.');
    // } else if (! pullRequest?.issue_number) {
    //   console.log('Pull Request is linked to an existing issue.');
    // }

    // const { data: issue } = await octokit.rest.issues.update({
    //   ...context,
    //   issue_number: pullRequest.issue_number,
    //   state,
    // });

    // if (! issue) {
    //   throw new Error('An issue attached to the Pull Request could not be found.');
    // }

    // console.log(`#${issue?.issue_number} was changed to ${issue.state}`);
}

run();