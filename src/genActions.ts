import { WorkflowEnvironment } from "@amazon-codecatalyst/blueprint-component.workflows";

export interface ActionProps {
  actionName: string;
  identifier: string;
  steps: string[];
  environment?: WorkflowEnvironment;
  dependancies?: string[];
  inputs?: { [key: string]: any[] };
  outputs?: { [key: string]: any };
}

/**
 * Generate an action for the workflow
 * @param props ActionProps
 * @returns Action
 */
export function GenerateAction(props: ActionProps) {
  return {
    [props.actionName]: {
      Identifier: props.identifier,
      Inputs: props.inputs ? props.inputs : { Sources: ["WorkflowSource"] },
      Outputs: props.outputs
        ? props.outputs
        : {
            AutoDiscoverReports: {
              IncludePaths: ["**/*"],
              ExcludePaths: ["*/.codecatalyst/workflows/*"],
              ReportNamePrefix: "AutoDiscovered",
              Enabled: true,
            },
          },
      Configuration: {
        Steps: props.steps.map((step) => ({ Run: step })),
      },
      Environment: props.environment,
      DependsOn: (props.dependancies) ? props.dependancies : undefined,
    },
  };
}
