const github = require('@actions/github');
const core = require('@actions/core');

async function run() {
    const githubToken = core.getInput('github_token');
    const pullNumber = core.getInput('pull_number');
    const state = core.getInput('state');

    const octokit = github.getOctokit(githubToken)
    const context = github.context;

    console.log({
      organization: context.payload.organization,
      sender: context.payload.sender,
      repository: context.payload.repository,
      githubToken,
      pullNumber,
      state,
    });

    const { data: pullRequest } = await octokit.rest.pulls.get({
      ...context,
      pull_number: pullNumber,
    });

    console.log(pullRequest);

    // if (! pullRequest) {
    //   throw new Error('Pull Request could not be found.');
    // }

    const { data: issue } = await octokit.rest.issues.update({
      ...context,
      issue_number: pullRequest.issue_number,
      state,
    });

    // if (! issue) {
    //   throw new Error('An issue attached to the Pull Request could not be found.');
    // }

    console.log(`#${issue?.issue_number} was changed to ${issue.state}`);
}

run();