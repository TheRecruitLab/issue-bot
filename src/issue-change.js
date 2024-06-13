import * as github from '@actions/github';
import * as core from '@actions/core';
import { getAPIClients } from './utils';

function getInputVars() {
  return {
    githubToken: core.getInput('github_token'),
  }
};

function getContextVars() {
  const context = github.context;

  return {
    owner: context.payload?.repository?.owner?.login,
    repo: context.payload?.repository?.name,
    payload: context.payload,
  };
}

async function run () {
  console.log({ ...getContextVars() });
};

run();