import { Aws, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Cors, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { LayerVersion, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import path from 'path';

export interface TodoApiStackProps extends StackProps {
  readonly allowedOrigins?: string;
};
export const ApiGatewayEndpointStackOutput = 'ApiEndpoint';
export const ApiGatewayDomainStackOutput = 'ApiDomain';
export const ApiGatewayStageStackOutput = 'ApiStage';

export class TodoApiStack extends Stack {
  ApiDomain: string;
  ApiStage: string;
  constructor(scope: Construct, id: string, props?: TodoApiStackProps) {
    super(scope, id, props);

    const ddb = new Table(this, 'TodosDB', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
    });

    const getTodos = createFunction(this, 'getTodos', ddb, props?.allowedOrigins);
    ddb.grantReadData(getTodos);

    const getTodo = createFunction(this, 'getTodo', ddb, props?.allowedOrigins);
    ddb.grantReadData(getTodo);

    const addTodo = createFunction(this, 'addTodo', ddb, props?.allowedOrigins);
    ddb.grantWriteData(addTodo);

    const deleteTodo = createFunction(this, 'deleteTodo', ddb, props?.allowedOrigins);
    ddb.grantWriteData(deleteTodo);

    const updateTodo = createFunction(this, 'updateTodo', ddb, props?.allowedOrigins);
    ddb.grantWriteData(updateTodo);

    const apiGateway = new RestApi(this, 'ApiGateway', {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
      deployOptions: {
        tracingEnabled: true,
      },
    });
    const api = apiGateway.root.addResource('api');

    const todos = api.addResource('todos', {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
    });

    todos.addMethod('GET', new LambdaIntegration(getTodos));
    todos.addMethod('POST', new LambdaIntegration(addTodo));

    const todoId = todos.addResource('{id}',{
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
    });
    todoId.addMethod('PUT', new LambdaIntegration(updateTodo));
    todoId.addMethod('GET', new LambdaIntegration(getTodo));
    todoId.addMethod('DELETE', new LambdaIntegration(deleteTodo));

    // export apigateway endpoint
    new CfnOutput(this, ApiGatewayEndpointStackOutput, {
      value: apiGateway.url
    });

    new CfnOutput(this, ApiGatewayDomainStackOutput, {
      value: apiGateway.url.split('/')[2]
    });

    new CfnOutput(this, ApiGatewayStageStackOutput, {
      value: apiGateway.deploymentStage.stageName
    });

    this.ApiDomain = apiGateway.url.split('/')[2];
    this.ApiStage = apiGateway.deploymentStage.stageName;
  }
}
function createFunction(scope: Construct, name: string, ddb: Table, allowedOrigins?: string) {
  return  new NodejsFunction(scope, name, {
    runtime: Runtime.NODEJS_20_X,
    entry: path.join(__dirname, `lambda/${name}.ts`),
    handler: 'lambdaHandler',
    bundling: {
      externalModules: [
        '@aws-lambda-powertools/commons',
        '@aws-lambda-powertools/logger',
        '@aws-lambda-powertools/metrics',
        '@aws-lambda-powertools/tracer',
      ],
    },
    environment: {
      DDB_TABLE: ddb.tableName,
      ALLOWED_ORIGINS: allowedOrigins || '*',
      POWERTOOLS_SERVICE_NAME: name,
      POWERTOOLS_METRICS_NAMESPACE: 'todoApp',
    },
    layers: [
      LayerVersion.fromLayerVersionArn(
        scope, `PowertoolsLayer-${name}`, `arn:aws:lambda:${Aws.REGION}:094274105915:layer:AWSLambdaPowertoolsTypeScript:4`
      )
    ],
    tracing: Tracing.ACTIVE,
});
}
