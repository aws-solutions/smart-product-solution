/*********************************************************************************************************************
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

import cdk = require('@aws-cdk/core');
import iot = require('@aws-cdk/aws-iot');
import iotAnalytics = require('@aws-cdk/aws-iotanalytics');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import { generateName } from './name-generator';

export interface SmartProductTelemetryProps {
  telemetryTopic: string;
  solutionVersion: string;
}

export class SmartProductTelemetry extends cdk.Construct {
  constructor(parent: cdk.Construct, name: string, props: SmartProductTelemetryProps) {
    super(parent, name);

    //=============================================================================================
    // Resources
    //=============================================================================================
    const smartProductTelemetryChannel = new iotAnalytics.CfnChannel(this, 'Channel', {
      channelName: 'smartproduct_channel'
    })

    const smartProductTelemetryRole = new iam.Role(this, 'SmartProductTelemetryRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com')
    });
    new iot.CfnTopicRule(this, 'StorageRule', {
      ruleName: 'SmartProductTelemetryRule',
      topicRulePayload: {
        actions: [{
          iotAnalytics: {
            channelName: `${smartProductTelemetryChannel.ref}`,
            roleArn: `${smartProductTelemetryRole.roleArn}`
          }
        }],
        description: 'Persistent storage of smart product telemetry data',
        ruleDisabled: false,
        sql: `select * from '${props.telemetryTopic}/#'`
      }
    });

    const smartProductLambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    });
    const smartProductTelemetryService = new lambda.CfnFunction(this, 'Service', {
      functionName: generateName(`${name}-service`, 64),
      description: "Smart Product Solution telemetry microservice",
      code: {
        s3Bucket: process.env.BUILD_OUTPUT_BUCKET,
        s3Key: `smart-product-solution/${props.solutionVersion}/smart-product-telemetry-service.zip`
      },
      handler: 'index.handler',
      runtime: 'nodejs10.x',
      role: smartProductLambdaRole.roleArn,
      timeout: 60,
      memorySize: 256
    });

    const smartProductTelemetryDatastore = new iotAnalytics.CfnDatastore(this, 'DataStore', {
      datastoreName: 'smartproduct_datastore'
    })

    const smartProductTelemetryPipeline = new iotAnalytics.CfnPipeline(this, 'Pipeline', {
      pipelineName: 'smartproduct_pipeline',
      pipelineActivities: [{
        channel: {
          name: "SmartProductChannelActivity",
          channelName: smartProductTelemetryChannel.ref,
          next: "SmartProductLambdaActivity"
        },
        lambda: {
          name: "SmartProductLambdaActivity",
          lambdaName: smartProductTelemetryService.ref,
          batchSize: 10,
          next: "SmartProductDatastoreActivity"
        },
        datastore: {
          name: "SmartProductDatastoreActivity",
          datastoreName: smartProductTelemetryDatastore.ref
        }
      }]
    });

    new iotAnalytics.CfnDataset(this, 'Dataset', {
      datasetName: 'smartproduct_dataset',
      actions:
        [
          {
            actionName: "SmartProductSqlAction",
            queryAction: {
              sqlQuery: 'select * from ' + smartProductTelemetryDatastore.ref
            }
          }
        ],
      triggers: [{
        schedule: { scheduleExpression: "rate(1 hour)" }
      }]
    });

    //=============================================================================================
    // Permissions and Policies
    //=============================================================================================
    const telemetryPolicy = new iam.Policy(this, 'TelemetryPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'iotanalytics:BatchPutMessage'
        ],
        resources: [`arn:aws:iotanalytics:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:channel/${smartProductTelemetryChannel.ref}`]
      })]
    })
    telemetryPolicy.attachToRole(smartProductTelemetryRole);

    const serviceLogPolicy = new iam.Policy(this, 'serviceLogPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents'
        ],
        resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${smartProductTelemetryService.functionName}:*`]
      })]
    })
    const serviceLogPolicyResource = serviceLogPolicy.node.findChild('Resource') as iam.CfnPolicy;
    serviceLogPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${smartProductLambdaRole.roleName} to access its own logs.`
        }]
      }
    }
    serviceLogPolicy.attachToRole(smartProductLambdaRole);

    new lambda.CfnPermission(this, 'LambdaInvokeTelemetryPermission', {
      functionName: `${smartProductTelemetryService.attrArn}`,
      action: 'lambda:InvokeFunction',
      principal: 'iotanalytics.amazonaws.com',
      sourceArn: `arn:aws:iotanalytics:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:pipeline/${smartProductTelemetryPipeline.ref}`,
      sourceAccount: cdk.Aws.ACCOUNT_ID
    })
  }
}