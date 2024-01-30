import { Environment } from "@amazon-codecatalyst/blueprint-component.environments";
import { SourceRepository } from "@amazon-codecatalyst/blueprint-component.source-repositories";
import {
  ComputeFleet,
  ComputeType,
  TriggerType,
  Workflow,
  WorkflowBuilder,
  convertToWorkflowEnvironment,
} from "@amazon-codecatalyst/blueprint-component.workflows";
import {
  Blueprint as ParentBlueprint,
  Options as ParentOptions,
} from "@amazon-codecatalyst/blueprints.blueprint";
import {
  CDK_DEFAULT_ACCOUNT,
  CDK_DEFAULT_REGION,
  CDK_DEFAULT_ROLE,
} from "./constants";
import { GenerateAction } from "./genActions";

export interface Options extends ParentOptions {}

/**
 * This is the actual blueprint class.
 * 1. This MUST be the only 'class' exported, as 'Blueprint'
 * 2. This Blueprint should extend another ParentBlueprint
 */
export class Blueprint extends ParentBlueprint {
  constructor(_options: Options) {
    super(_options);

    // Add a repository
    const repository = new SourceRepository(this, {
      title: "cdk-todo-web-app",
    });

    // Add an environment
    const environment = new Environment(this, {
      name: "default_environment",
      environmentType: "DEVELOPMENT",
      description: "Blueprint environment",
      awsAccount: {
        cdkRole: { name: CDK_DEFAULT_ROLE },
        id: CDK_DEFAULT_ACCOUNT,
        name: CDK_DEFAULT_ACCOUNT,
      },
    });

    /**
     * Define the actions for the workflow
     * 1. FrontendBuildAndPackage
     * 2. FrontendTest
     * 3. CDKBootstrapAction
     * 4. CDKDeploy
     */
    // FrontendBuildAndPackage
    const frontendBuildAndPackage = GenerateAction({
      actionName: "FrontendBuildAndPackage",
      identifier: "aws/build@v1",
      outputs: {
        Artifacts: [
          {
            Name: "frontend",
            Files: ["**/*"],
          },
        ],
      },
      steps: [
        "cd static-assets/frontend",
        "npm install",
        'echo "REACT_APP_SERVICE_URL=/api/todos" > ".env"',
        "npm run build",
      ],
    });

    // FrontendTest
    const frontendTest = GenerateAction({
      actionName: "FrontendTest",
      identifier: "aws/managed-test@v1",
      outputs: {
        AutoDiscoverReports: {
          IncludePaths: ["frontend/**/*.xml"],
          ExcludePaths: ["frontend/node_modules/**/*"],
          ReportNamePrefix: "AutoDiscovered",
          Enabled: true,
          SuccessCriteria: { PassRate: 100 },
        },
      },
      steps: [
        "cd static-assets/frontend",
        "npm install",
        "npm test -- --coverage --watchAll=false;",
      ],
    });

    // CDKBootstrapAction
    const cdkBootstrapAction = {
      CDKBootstrapAction: {
        Identifier: "aws/cdk-bootstrap@v1",
        Configuration: {
          Region: CDK_DEFAULT_REGION,
          CdkCliVersion: "latest",
        },
        Environment: convertToWorkflowEnvironment(environment),
        DependsOn: ["FrontendTest", "FrontendBuildAndPackage"],
      },
    };

    // CDKDeploy
    const cdkDeploy = GenerateAction({
      actionName: "CDKDeploy",
      identifier: "aws/build@v1",
      inputs: {
        Artifacts: ["frontend"],
      },
      dependancies: ["CDKBootstrapAction"],
      steps: [
        "cp -r static-assets/frontend/build static-assets/cdkStack/src/lib/frontend/",
        "cd static-assets/cdkStack",
        "npm install -g pnpm",
        "pnpm i --no-frozen-lockfile",
        `export CDK_DEPLOY_ACCOUNT=${CDK_DEFAULT_ACCOUNT}`,
        `export CDK_DEPLOY_REGION=${CDK_DEFAULT_REGION}`,
        "pnpm dlx projen deploy --all --require-approval never",
      ],
      environment: convertToWorkflowEnvironment(environment)!,
      outputs: {
        AutoDiscoverReports: {
          IncludePaths: ["**/*"],
          ExcludePaths: ["*/.codecatalyst/workflows/*"],
          ReportNamePrefix: "AutoDiscovered",
          Enabled: true,
        },
      },
    });

    // Create a workflow builder
    const workflowBuilder = new WorkflowBuilder(this, {
      Name: "main_fullstack_workflow",
      Compute: {
        Type: ComputeType.EC2,
        Fleet: ComputeFleet.LINUX_X86_64_LARGE,
      },
      Triggers: [
        {
          Branches: ["main"],
          Type: TriggerType.PUSH,
        },
      ],
      Actions: {
        ...frontendBuildAndPackage,
        ...frontendTest,
        ...cdkBootstrapAction,
        ...cdkDeploy,
      },
    });

    // Write a workflow to my repository
    new Workflow(this, repository, workflowBuilder.getDefinition());
  }
}
