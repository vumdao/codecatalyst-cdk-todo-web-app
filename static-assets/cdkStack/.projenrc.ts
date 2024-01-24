import { awscdk, javascript } from 'projen';
import { UpdateSnapshot } from 'projen/lib/javascript';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.122.0',
  defaultReleaseBranch: 'main',
  github: false,
  name: 'dk-todo-web-app',
  appEntrypoint: 'bin/main.ts',
  packageManager: javascript.NodePackageManager.PNPM,
  projenrcTs: true,
  typescriptVersion: '4.3.5',
  deps: [
    'cdk-nag',
    '@middy/core',
    'aws-sdk',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/client-lambda',
    '@aws-sdk/lib-dynamodb',
    'aws-sdk-mock',
  ],
  jestOptions: {
    updateSnapshot: UpdateSnapshot.NEVER,
  },
});
project.synth();