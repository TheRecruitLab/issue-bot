const github = require('@actions/github');
const { graphql } = require("@octokit/graphql");

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
}