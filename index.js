const github = require('@actions/github');
const core = require('@actions/core');

async function run() {
    const myToken = core.getInput('myToken');
    const issueNumber = core.getInput('issue_number');
    const state = core.getInput('state');

    const octokit = github.getOctokit(myToken)
    const context = github.context;

    const { data: pullRequest } = await octokit.rest.issues.update({
      ...context,
      issue_number: issueNumber,
      state,
    });

    console.log(pullRequest);
}

run();