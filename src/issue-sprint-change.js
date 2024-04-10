const github = require('@actions/github');
const core = require('@actions/core');
const { graphql } = require("@octokit/graphql");

function getInputVars() {
  return {
    githubToken: core.getInput('github_token'),
  }
};

async function handleIssueChange() {
  const { githubToken } = getInputVars();
  const { payload } = getContextVars();

  console.log({ payload });
}

async function run() {
  await handleIssueChange();
}

run();