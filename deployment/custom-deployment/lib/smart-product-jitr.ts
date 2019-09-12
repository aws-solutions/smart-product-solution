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
import iam = require('@aws-cdk/aws-iam');
import dynamodb = require('@aws-cdk/aws-dynamodb');
import lambda = require('@aws-cdk/aws-lambda');
import { generateName } from './name-generator';

export interface SmartProductJITRProps {
  spTelemetryTopic: string;
  spEventTopic: string;
  solutionVersion: string;
  registrationTable: dynamodb.Table;
  solutionId: string;
  solutionUuid: string;
  anonymousData: string;
}

export class SmartProductJITR extends cdk.Construct {

  constructor(parent: cdk.Construct, name: string, props: SmartProductJITRProps) {
    super(parent, name);

    //=============================================================================================
    // Resources
    //=============================================================================================
    const jitrServiceRole = new iam.Role(this, 'ServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })

    const jitrService = new lambda.CfnFunction(this, 'Service', {
      functionName: generateName(`${name}-Service`, 64),
      description: "Smart Product Solution Just-In-Time-Registration microservice",
      code: {
        s3Bucket: process.env.BUILD_OUTPUT_BUCKET,
        s3Key: `smart-product-solution/${props.solutionVersion}/smart-product-jitr-service.zip`
      },
      handler: 'index.handler',
      runtime: 'nodejs8.10',
      role: jitrServiceRole.roleArn,
      timeout: 60,
      memorySize: 256,
      environment: {
        variables: {
          TELEMETRY_TOPIC: props.spTelemetryTopic,
          EVENT_TOPIC: props.spEventTopic,
          REGISTRATION_TBL: props.registrationTable.tableName,
          LOGGING_LEVEL: '2',
          solutionId: props.solutionId,
          solutionUuid: props.solutionUuid,
          anonymousData: props.anonymousData
        }
      }
    })

    const jitrRule = new iot.CfnTopicRule(this, 'Rule', {
      ruleName: "SmartProductJitrRule",
      topicRulePayload: {
        actions: [{
          lambda: {
            functionArn: jitrService.attrArn
          }
        }],
        description: 'Just in time registration (JITR) for Smart Product Solution.',
        ruleDisabled: false,
        sql: `SELECT * FROM '$aws/events/certificates/registered/#'`,
      }
    })

    //=============================================================================================
    // Permissions and Policies
    //=============================================================================================
    // JITR Log Policy
    const jitrLogPolicy = new iam.Policy(this, 'jitrLogPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents'
        ],
        resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${jitrService.functionName}:*`]
      })]
    })
    const jitrLogPolicyResource = jitrLogPolicy.node.findChild('Resource') as iam.CfnPolicy;
    jitrLogPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${jitrServiceRole.roleName} to access its own logs.`
        }]
      }
    }
    jitrLogPolicy.attachToRole(jitrServiceRole);

    // Notification Dynamo Policy
    const notificationDynamoPolicy = new iam.Policy(this, 'notificationDynamoPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'dynamodb:Query',
          'dynamodb:UpdateItem'
        ],
        resources: [
          `${props.registrationTable.tableArn}`,
          `${props.registrationTable.tableArn}/index/deviceId-index`
        ]
      })]
    })
    notificationDynamoPolicy.attachToRole(jitrServiceRole);

    // JITR IoT Policy
    const jitrIotPolicy = new iam.Policy(this, 'jitrIotPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'iot:UpdateCertificate',
          'iot:CreatePolicy',
          'iot:AttachPrincipalPolicy',
          'iot:DescribeCertificate',
          'iot:AttachThingPrincipal'
        ],
        resources: [`*`]
      })]
    })
    const jitrIotPolicyResource = jitrIotPolicy.node.findChild('Resource') as iam.CfnPolicy;
    jitrIotPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${jitrServiceRole.roleName} to exchange information with solution resources.`
        }]
      }
    }
    jitrIotPolicy.attachToRole(jitrServiceRole);

    new lambda.CfnPermission(this, 'LambdaInvokeJitrPermission', {
      functionName: `${jitrService.functionName}`,
      action: 'lambda:InvokeFunction',
      principal: 'iot.amazonaws.com',
      sourceArn: `${jitrRule.attrArn}`,
      sourceAccount: cdk.Aws.ACCOUNT_ID
    })
  }
}
