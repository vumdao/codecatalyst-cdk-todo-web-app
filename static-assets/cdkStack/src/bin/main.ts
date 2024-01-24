import { App } from 'aws-cdk-lib';
import { TodoApiStack } from '../lib/backend/todo-api-stack';
import { FrontendStack } from '../lib/frontend/frontend-stack';

const app = new App();

const backend = new TodoApiStack(app, 'TodoApiStack', {
  allowedOrigins: '*.simflexcloud.com',
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION,
  },
  tags: {
    project: 'cdk-todo-web-app',
    owner: 'codecatalyst'
  }
});

new FrontendStack(app, 'FrontendStack', {
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION,
  },
  tags: {
    project: 'cdk-todo-web-app',
    owner: 'codecatalyst'
  },
  apiDomain: backend.ApiDomain,
  apiStage: backend.ApiStage,
});

app.synth();
