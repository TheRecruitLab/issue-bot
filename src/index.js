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

    console.log(issueTesting);
  const { repository: testing } = await graphqlWithAuth(`
  {
    repository(owner: "${owner}", name: "${repo}") {
      name,
      project(number: 2) {
        id,
        title
      },
      issue (number: ${linkedIssue.number}) {
        id,
        number,
        projectCards(first: 50) {
          nodes {
            id,
            project {
              id
            }
          },
          totalCount
        },
        projectItems(first: 10) {
          ... on ProjectV2ItemConnection {
            nodes {
              ... on ProjectV2Item {
                project {
                  ... on ProjectV2 {
                    id, title
                  }
                }
              }
            }
          }
        },
        projectsV2(first: 100) {
          nodes {
            id
          },
          totalCount
        }
      },
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