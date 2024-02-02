# Inputs

| Input          | Default | Required | Description                                                   |
| --------------------------------------------------------------------------------------------------- |
| github_token   | -       | true     | The github token used to authenticate with the github API     |
| requires_merge | true    | true     | Determines if the PR must be merged to modify the issue state |
| state          | open    | true     | The issue state to be set                                     |


# About
The purpose of this action is to be able to modify an issue's stat via a pull_request event from a github workflow

# Project Setup

### Dependencies
* `nvm or node 20`
* `npm`

### Setup
* `nvm use`
* `npm install`

### Building the project
* `npm run build`

