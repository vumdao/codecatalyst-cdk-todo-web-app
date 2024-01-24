import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TodoApiStack } from '../src/lib/backend/todo-api-stack';

// example test. To run these tests, uncomment this file along with the
// example resource in lib/ts-lambda-stack.ts
test('Check Resource Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new TodoApiStack(app, 'UnitTestStack');
  // THEN
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::Lambda::Function', 5);
  template.resourceCountIs('AWS::DynamoDB::Table', 1);
  template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
});
