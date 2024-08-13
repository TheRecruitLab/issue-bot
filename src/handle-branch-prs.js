import * as github from '@actions/github';
import * as core from '@actions/core';
import { graphql } from "@octokit/graphql"
import { getListOfPullRequests } from './api/getListOfPullRequests';
import { createPullRequest } from './createPullRequest';
import { getPullRequestCommits } from './api/getPullRequestCommits';
import { updatePullRequest } from './api/updatePullRequest';
import { compareBranches } from './api/compareBranches';

export function getAPIClients(githubToken) {
    const octokit = github.getOctokit(githubToken)
    const graphqlWithAuth = graphql.defaults({
        headers: {
          authorization: `token ${githubToken}`,
        },
    });

    return {
        octokit,
        graphqlWithAuth,
    };
};

function getInputVars() {
  return {
    githubToken: core.getInput('github_token'),
    from: core.getInput('from'),
    to: core.getInput('to'),
  }
};

function getContextVars() {
  const context = github.context;

  return {
    owner: context.payload?.repository?.owner?.login,
    repo: context.payload?.repository?.name,
    payload: context.payload,
  };
};

export function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
};

async function getChunkedData(callbackFn, params)
{
  const nextPattern = /(?<=<)([\S]*)(?=>; rel="Next")/i;
  let pagesRemaining = true;
  let data = [];
  let page = 1;

  while (pagesRemaining) {
    const response = await callbackFn({ ...params, page });

    data = data.append(response.data ?? []);

    const linkHeader = response.headers.link;

    pagesRemaining = linkHeader && linkHeader.includes(`rel=\"next\"`);

    if (pagesRemaining) {
      url = linkHeader.match(nextPattern)[0];
      page++;
    }
  }

  return data;
};

function parseCommitMessages(messages = [])
{
  const regexChecks = [/\/([0-9]{0,9})\//g, /\|([0-9]{0,9})\|/g];

  return messages.reduce((prev, curr) => {
    const trimmedStr = curr.replace(/\s+/g, '');

    for(const check of regexChecks) {
      const matches = trimmedStr.match(check);

      for(const match of matches) {
        const issueNumberMatch = match.match(/[0-9]{1,9}/g);

        if (issueNumberMatch?.length) {
          prev += `* #${issueNumberMatch[0]}\n`;
        }
      }
    }

    return prev;
  }, '');
}

async function handlePRSync() {
  const { githubToken, from, to } = getInputVars();
  const { owner, repo, payload } = getContextVars();
  const { octokit } = getAPIClients(githubToken);
  
  if (! payload?.pull_request) {
    throw new Error('Invalid Github event. Must be a pull_request event.');
  }
  
  const baseParams = { octokit, owner, repo };

  // Create PR if branches are out of date
  const data = await getChunkedData(getListOfPullRequests, { ...baseParams, base: to });
  let pullRequest = data.find(({ base, head }) => base.ref === to && head.ref === from);

  console.log(`PR Exists: ${Boolean(pullRequest)}`);

  if (! pullRequest) {
    const comparison = await compareBranches({ ...baseParams, base: to, head: from });
    const branchesNotInSync = comparison?.ahead_by !== 0 || comparison?.ahead_by !== 0;

    console.log(`PR In sync: ${!Boolean(branchesNotInSync)}`);
    
    if (comparison?.ahead_by !== 0 || comparison?.ahead_by !== 0) {
      console.log('Creating Pull Request.');

      pullRequest = await createPullRequest({ ...baseParams, base: to, head: from });
    }
  }

  if (! pullRequest) {
    return;
  }

  console.log('Fetching commit messages');
  const commitMessages = await getChunkedData(getPullRequestCommits, { ...baseParams, pull_number: pullRequest?.issue_number });

  console.log('Parsing Commit messages');
  const pullRequestBody = parseCommitMessages(commitMessages);

  console.log('Syncing commit messages to pull request body');
  await updatePullRequest({ octokit, owner, repo, pull_number: pullRequest?.issue_number, body: pullRequestBody });
}

async function run () {
  await handlePRSync();
};

run();