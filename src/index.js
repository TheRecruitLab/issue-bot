const github = require('@actions/github');
const core = require('@actions/core');
const { graphql } = require("@octokit/graphql");

async function run() {
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
              timelineItems(first: 100, itemTypes: [AddedToProjectEvent]) {
                nodes {
                  id,
                  project {
                    id
                  }
                }
              }
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

  if (requiresMerge && ! repository?.pullRequest?.merged) {
    console.log('The Pull Request must be merged in order to update associated issues.');
    
    return;
  }

  const linkedIssues = repository?.pullRequest?.closingIssuesReferences?.nodes || [];

  for (const linkedIssue of linkedIssues) {
    const { data: issue } = await octokit.rest.issues.update({
      repo,
      owner,
      issue_number: linkedIssue.number,
      state,
    });

    if (! issue) {
      throw new Error('An issue attached to the Pull Request could not be found.');
    }
    console.log(linkedIssue);

    for (const project of (linkedIssue?.projectsV2?.nodes || [])) {
      console.log('PROJECT ID', project?.id);
      for (const field of (project?.fields?.nodes || [])) {
        console.log('FIELD', { ...field });
      }
    }

  const { node: testing } = await graphqlWithAuth(`
  {
    node(id: "PVT_kwDOCI-95M4AUzl4") {
      ... on ProjectV2 {
        items(first: 100) {
          nodes {
            id
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldDateValue {
                  date
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldRepositoryValue {
		              repository {
                     name                  
		              }
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`);

console.log('testing', { ...testing });

  //   await graphqlWithAuth(`
  //   mutation {
  //     updateProjectV2ItemFieldValue(
  //       input: {
  //         projectId: "PROJECT_ID"
  //         itemId: "ITEM_ID"
  //         fieldId: "FIELD_ID"
  //         value: { 
  //           singleSelectOptionId: "OPTION_ID"        
  //         }
  //       }
  //     ) {
  //       projectV2Item {
  //         id
  //       }
  //     }
  //   }
  // `);

    console.log(`#${linkedIssue.number} was changed to ${issue.state}`);
  }
}

run();