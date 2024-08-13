import * as github from '@actions/github';
import * as core from '@actions/core';
import { graphql } from "@octokit/graphql"

export function getAPIClients(githubToken) {
    console.log('token' + githubToken?.length);
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
}

async function getListOfPullRequests(octokit, { owner, repo, base, state = 'open' }) {
  const pullRequests = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    base: 'production',
    state,
    per_page: 100,
    sort: 'created',
    direction: 'desc',
  });

  return pullRequests.data.map(({ base, head }) => ({ base, head }));
};

async function compareBranches(octokit, { owner, repo, base, head }) {
  const response = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
    owner,
    repo,
    basehead: `${base}...${head}`,
  });

  return response.data;
}
 
async function handlePRMergeOperation() {
  console.log('1');
  const { githubToken, from, to } = getInputVars(); console.log('2');
  const { owner, repo, payload } = getContextVars(); console.log('3');
  const { octokit, graphqlWithAuth } = getAPIClients(githubToken); console.log('4');

  if (! payload?.pull_request) {
      throw new Error('Invalid Github event. Must be a pull_request event.');
  }

  // Check branches are out of date
  const data = await getListOfPullRequests(octokit, { owner, repo, base: to });
  const foundPR = data.find(({ base, head }) => base.ref === to && head.ref === from);

  for(const el of data) {
    console.log(el.base, el.head);
  }

  console.log({ foundPR, data });

  if (! foundPR) {
    const comparison = await compareBranches(octokit, { owner, repo, base: to, head: from });
    console.log(comparison);
  }

  // Check if PR exists

  // Create PR if not exists 

  // const { repository } = await graphqlWithAuth(`
  //   {
  //     repository(owner: "${owner}", name: "${repo}") {
  //       pullRequest(number: ${payload.pull_request.number}) {
  //         author {
  //           login
  //         },
  //         closingIssuesReferences(first: 100) { 
  //           nodes {
  //             id,
  //             number,
  //             projectsV2(first: 100) {
  //               nodes {
  //                 id
  //               }
  //             },
  //             projectItems(first: 100) {
  //               edges {
  //                 cursor,
  //                 node {
  //                   id,
  //                   isArchived
  //                 }
  //               }
  //             }
  //           }
  //         },
  //         id,
  //         merged,
  //         number,
  //         state,
  //       }
  //     }
  //   }
  // `);

  // const linkedIssues = repository?.pullRequest?.closingIssuesReferences?.nodes || [];

  // for (const linkedIssue of linkedIssues) {
  //   const { data: issue } = await octokit.rest.issues.update({
  //     repo,
  //     owner,
  //     issue_number: linkedIssue.number,
  //     state,
  //   });

  //   if (! issue) {
  //     console.error('An issue attached to the Pull Request could not be found.');
  //   }

  //   console.log(`#${linkedIssue.number} was changed to ${issue.state}`);
  // }
}

async function run () {
  console.log('begin');
  await handlePRMergeOperation();
};

run();