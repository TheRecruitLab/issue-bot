import * as github from '@actions/github';
import * as core from '@actions/core';
import { graphql } from "@octokit/graphql"

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

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
};

function capitalize(value) {
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
    data = [...data, ...(response.data ?? [])];

    const linkHeader = response.headers?.link;

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
  const issues = [];

  for(const message of messages) {
    const trimmedStr = message.replace(/\s+/g, '');
  
    for(const check of regexChecks) {
      const matches = trimmedStr.match(check) ?? [];

      for(const match of matches) {
        const issueNumberMatch = match.match(/[0-9]{1,9}/g) ?? [];
        const [issueNumber] = issueNumberMatch;

        if (issueNumber?.length && !issues.includes(issueNumber)) {
          issues.push(issueNumber);
        }
      }
    }
  }

  return { 
    message: issues.reduce((prev, curr) => `${prev}* #${curr}\n`, ''), 
    issues,
  };
}

async function getIssueWithProjectInfo({graphqlWithAuth, owner, repo, issue, status, statusField })
{
  const { repository } = await graphqlWithAuth(`
    {
      repository(owner: "${owner}", name: "${repo}") {
        issue(number: ${issue}) { 
          id,
          number,
          projectsV2(first: 100) {
            nodes {
              id,
              title,
              field(name: "Status") {
                ...on ProjectV2SingleSelectField {
                  id,
                  name,
                  options (names: ["${status}"]) {
                    id,
                    name
                  }
                }
              }
            },
          },
          projectItems(first: 100) {
            nodes {
              id,
              project {
                id
              },
              fieldValueByName(name: "${statusField}") {
                ...on ProjectV2ItemFieldSingleSelectValue {
                  id
                }
              }
            }
          }
        },
      }
    }`);

  return repository?.issue;
};

async function getIssuesWithProjectInfo({graphqlWithAuth, owner, repo, issues, status, statusField })
{
  const issuesWithProjectInfo = [];

  for(const issue of issues) {
    const data = await getIssueWithProjectInfo({
      graphqlWithAuth,
      owner,
      repo,
      issue,
      status,
      statusField,
    });

    issuesWithProjectInfo.push(data);

    sleep(500); // There could be a lot of issues to link, so let's throttle this to 2 per second
  }
  
  return issuesWithProjectInfo;
};

async function updateIssue({ octokit, owner, repo, issue_number, ...rest })
{
  await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
    owner,
    repo,
    issue_number,
    ...rest,
  });
}

async function updateProjectItemValue({ graphqlWithAuth, project, projectItem, option })
{
  await graphqlWithAuth(`
    mutation {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: "${project?.id}"
          itemId: "${projectItem.id}"
          fieldId: "${project?.field?.id}"
          value: { 
            singleSelectOptionId: "${option.id}"        
          }
        }
      ) {
        projectV2Item {
          id
        }
      }
    }
  `);
}

async function getListOfPullRequests({ octokit, owner, repo, base, state = 'open' }) {
  return octokit.request('GET /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    base,
    state,
    per_page: 100,
    sort: 'created',
    direction: 'desc',
  });
};

async function compareBranches({ octokit, owner, repo, base, head }) {
  const response = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
    owner,
    repo,
    basehead: `${base}...${head}`,
  });

  return response.data;
};

async function createPullRequest({ octokit, owner, repo, base, head }) {
  const response = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    title: `${capitalize(head)} -> ${capitalize(base)}`,
    body: '',
    head,
    base,
  });

  return response.data;
}

async function updatePullRequest({ octokit, owner, repo, pull_number, body })
{
  return octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number,
    body,
  });
}

async function getPullRequestCommits({ octokit, owner, repo, pull_number, page = 1 })
{
  return octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', {
    owner,
    repo,
    pull_number,
    per_page: 100,
    page,
  });
}

async function addItemToProject({ graphqlWithAuth, projectId, itemId, statusField }) 
{
  return graphqlWithAuth(`
    mutation {
      addProjectV2ItemById(
        input: {
          projectId: "${projectId}"
          itemId: "${itemId}"
        }
      ) {
        item {
          id,
          number,
          projectItems(first: 100) {
            nodes {
              id,
              fieldValueByName(name: "${statusField}") {
                ...on ProjectV2ItemFieldSingleSelectValue {
                  id
                }
              }
            }
          }
        }
      }
    }
  `);
}
 
async function handlePRSync() {
  const { githubToken, from, to } = getInputVars();
  const { owner, repo, payload } = getContextVars();
  const { octokit, graphqlWithAuth } = getAPIClients(githubToken);
  
  if (! payload?.pull_request) {
    throw new Error('Invalid Github event. Must be a pull_request event.');
  }
  
  const baseRestParams = { octokit, owner, repo };
  const baseGraphqlParams = { graphqlWithAuth, owner, repo };

  // Create PR if branches are out of date
  const data = await getChunkedData(getListOfPullRequests, { ...baseRestParams, base: to });
  let pullRequest = data.find(({ base, head }) => base.ref === to && head.ref === from);

  console.log(`PR Exists: ${Boolean(pullRequest)}`);

  if (! pullRequest && to !== from) {
    const comparison = await compareBranches({ ...baseRestParams, base: to, head: from });
    const branchesNotInSync = comparison?.ahead_by !== 0 || comparison?.behind_by !== 0;

    console.log(`PR In sync: ${!Boolean(branchesNotInSync)} | Ahead by: ${comparison?.ahead_by} | Behind by: ${comparison?.behind_by}`);
    
    // Can only create PR if head is ahead of base. Cannot create on otherwise, or an error will occur.
    if (comparison?.ahead_by !== 0) {
      console.log('Creating Pull Request.');

      pullRequest = await createPullRequest({ ...baseRestParams, base: to, head: from });
    }
  } else if (! pullRequest && to === from) {
    pullRequest = payload?.pull_request;
  }
  
  if (! pullRequest) {
    return;
  }

  console.log(`Fetching commit messages for PR #${pullRequest?.number}`);
  const commitMessages = await getChunkedData(getPullRequestCommits, { ...baseRestParams, pull_number: pullRequest?.number });
  const mappedCommitMessages = commitMessages.map((commit) => commit?.commit?.message);

  console.log('Parsing Commit messages');
  const { issues: issueNumbers, message: pullRequestBody } = parseCommitMessages(mappedCommitMessages);

  // Do not update PR if to and from are the same
  if (to !== from ) {
    console.log('Syncing commit messages to pull request body');
    await updatePullRequest({ 
      ...baseRestParams, 
      pull_number: pullRequest?.number, 
      body: pullRequestBody,
    });
  }

  console.log('Retrieving issue information');
  const issues = await getIssuesWithProjectInfo({ 
    ...baseGraphqlParams, 
    issues: issueNumbers, 
    status: from, 
    statusField: 'Status',
  });

  const projects = [];

  for (const issue of issues) {
    for (const project of (issue?.projectsV2?.nodes || [])) {
      const projectItem = issue.projectItems?.nodes?.find((projectItem) => projectItem?.project?.id === project?.id);
      const [option] = (project?.field?.options || []);
      
      if (option && projectItem) {
        if (! projects.some((value) => value?.project?.id === project?.id)) {
          projects.push({ project, option });
        }
        
        await updateProjectItemValue({ 
          graphqlWithAuth, 
          project, 
          projectItem, 
          option, 
        });

        console.log(`Successfully changed Status to ${from} on ${project?.title} for issue #${issue?.number}`);
      }
    }

    if (from === 'production') {
      await updateIssue({
        ...baseRestParams,
        issue_number: issue?.number,
        state: 'closed',
      });

      console.log(`Successfully changed closed issue #${issue?.number}`);
    }
  }
  
  for(const { project, option } of projects) {
    const item = await addItemToProject({ ...baseGraphqlParams, projectId: project?.id, itemId: pullRequest?.id, statusField: 'Status' });
    const issue = await getIssueWithProjectInfo({
      ...baseGraphqlParams, 
      issue: item, 
      status: from, 
      statusField: 'Status',
    });

    const projectItem = issue.projectItems?.nodes?.find((projectItem) => projectItem?.project?.id === project?.id);

    await updateProjectItemValue({ 
      graphqlWithAuth, 
      project,
      projectItem, 
      option, 
    });
  }
}

async function run () {
  await handlePRSync();
};

run();