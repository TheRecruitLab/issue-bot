const github = require('@actions/github');
const core = require('@actions/core');
const { graphql } = require("@octokit/graphql");

async function handleMergeOperation() {
  const githubToken = core.getInput('github_token');
  const state = core.getInput('state');
  const requiresMerge = Boolean(core.getInput('requires_merge')) === 'true';

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
          },
          closingIssuesReferences(first: 100) { 
            nodes {
              id,
              number,
              projectsV2(first: 100) {
                nodes {
                  id
                }
              },
              projectItems(first: 100) {
                edges {
                  cursor,
                  node {
                    id,
                    isArchived
                  }
                }
              }
            }
          },
          id,
          merged,
          number,
          state,
        }
      }
    }
  `);

  const linkedIssues = repository?.pullRequest?.closingIssuesReferences?.nodes || [];

  for (const linkedIssue of linkedIssues) {
    const { data: issue } = await octokit.rest.issues.update({
      repo,
      owner,
      issue_number: linkedIssue.number,
      state,
    });

    if (! issue) {
      console.error('An issue attached to the Pull Request could not be found.');
    }

    for (const project of (linkedIssue?.projectsV2?.nodes || [])) {
      console.log('PROJECT ID', project?.id);
      for (const field of (project?.fields?.nodes || [])) {
        console.log('FIELD', { ...field });
      }
    }


    await graphqlWithAuth(`
    mutation {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: "PVTI_lADOCI-95M4AUzl4zgNXQvM'"
          itemId: "ITEM_ID"
          fieldId: "FIELD_ID"
          value: { 
            singleSelectOptionId: "OPTION_ID"        
          }
        }
      ) {
        projectV2Item {
          id
        }
      }
    }
  `);

    console.log(`#${linkedIssue.number} was changed to ${issue.state}`);
  }
}

async function handleStatusChange() {
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

  const { organization } = await graphqlWithAuth(`
    {
      organization(login: "${owner}") {
        id,
        projects {
          id
        },
        projectsV2 {
          nodes {
            id
            items {
              nodes {
                id
                content {
                  ...on Issue {
                    title,
                    number
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  console.log({
    organization,
    projects: organization.projectsV2,
  });
}

async function handleOperation (operation) {
  switch (operation) {
    case 'merge':
      await handleMergeOperation();
      break;
    case 'status_change':
      await handleStatusChange();
      break;
    default:
      console.error('Invalid Operation');
  }
}

async function run() {
  const operation = core.getInput('operation');

  await handleOperation(operation);
}

run();