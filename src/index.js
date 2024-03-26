const github = require('@actions/github');
const core = require('@actions/core');
const { graphql } = require("@octokit/graphql");

function getInputVars() {
  return {
    githubToken: core.getInput('github_token'),
    state: core.getInput('state'),
    status: core.getInput('status'),
    statusField: core.getInput('status_field'),
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

function getAPIClients(githubToken) {
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
}

async function handlePRMergeOperation() {
  const { githubToken, state } = getInputVars();
  const { owner, repo, payload } = getContextVars();
  const { octokit, graphqlWithAuth } = getAPIClients(githubToken);

  if (! payload?.pull_request) {
      throw new Error('Invalid Github event. Must be a pull_request event.');
  }

  const { repository } = await graphqlWithAuth(`
    {
      repository(owner: "${owner}", name: "${repo}") {
        pullRequest(number: ${payload.pull_request.number}) {
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

    console.log(`#${linkedIssue.number} was changed to ${issue.state}`);
  }
}

async function handlePRStatusChange() {
  const { githubToken, status, statusField } = getInputVars();
  const { owner, repo, payload } = getContextVars();
  const { graphqlWithAuth } = getAPIClients(githubToken);

  if (! payload?.pull_request) {
    throw new Error('Invalid Github event. Must be a pull_request event.');
}

  const { repository } = await graphqlWithAuth(`
  {
    repository(owner: "${owner}", name: "${repo}") {
      pullRequest(number: ${payload.pull_request.number}) {
        author {
          login
        },
        closingIssuesReferences(first: 100) { 
          nodes {
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
              }
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
          }
        },
        id,
        merged,
        number,
        state,
      }
    }
  }`);

  const linkedIssues = repository?.pullRequest?.closingIssuesReferences?.nodes || [];

  for (const linkedIssue of linkedIssues) {
    for (const project of (linkedIssue?.projectsV2?.nodes || [])) {

      const projectItem = linkedIssue.projectItems?.nodes?.find((projectItem) => projectItem?.project?.id === project?.id);
      const [option] = (project?.field?.options || []);

      if (option && projectItem) {
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

        console.log(`Successfully changed ${statusField} to ${status} on ${project?.title}`);
      }
    }
  }
}

async function run() {
  await handlePRMergeOperation();
  await handlePRStatusChange();
}

run();