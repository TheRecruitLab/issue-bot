const github = require('@actions/github');
const core = require('@actions/core');

async function run() {
    const githubToken = core.getInput('github_token');
    const pullNumber = core.getInput('pull_number');
    const state = core.getInput('state');

    const octokit = github.getOctokit(githubToken)
    const context = github.context;

    console.log({
      github: github.context.payload.pull_request,
      state,
    });

    console.log({
      github: context.payload,
      repo: context?.payload?.repository?.name,
      owner: context?.payload?.repository?.owner?.name
    });

    // const { data: pullRequest } = await octokit.rest.pulls.get({
    //   repo: context.payload.sender.repository.name,
    //   owner: context.payload.sender.owner.name,
    //   pull_number: pullNumber,
    // });

    // console.log(pullRequest);

    // if (! pullRequest) {
    //   throw new Error('Pull Request could not be found.');
    // }

    // const { data: issue } = await octokit.rest.issues.update({
    //   ...context,
    //   issue_number: pullRequest.issue_number,
    //   state,
    // });

    // if (! issue) {
    //   throw new Error('An issue attached to the Pull Request could not be found.');
    // }

    console.log(`#${issue?.issue_number} was changed to ${issue.state}`);
}

run();