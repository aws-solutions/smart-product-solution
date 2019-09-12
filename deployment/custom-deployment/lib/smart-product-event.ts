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
import lambda = require('@aws-cdk/aws-lambda');
import sns = require('@aws-cdk/aws-sns');
import dynamodb = require('@aws-cdk/aws-dynamodb');
import cognito = require('@aws-cdk/aws-cognito')
import { generateName } from './name-generator';

export interface SmartProductEventProps {
  eventsTable: dynamodb.Table;
  registrationTable: dynamodb.Table;
  userPool: cognito.UserPool;
  settingsTable: dynamodb.Table;
  solutionVersion: string;
  eventTopic: string;
}

export class SmartProductEvent extends cdk.Construct {

  constructor(parent: cdk.Construct, name: string, props: SmartProductEventProps) {
    super(parent, name);

    //=============================================================================================
    // Resources
    //=============================================================================================
    const notificationSnsTopic = new sns.Topic(this, 'Topic', { displayName: 'SmartProductNotificationSNS' });

    const notificationServiceRole = new iam.Role(this, 'NotificationRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })
    const notificationService = new lambda.CfnFunction(this, 'NotificationService', {
      functionName: generateName(`${name}-NotificationService`, 64),
      description: "Smart Product Solution SNS and MQTT notification microservice",
      code: {
        s3Bucket: process.env.BUILD_OUTPUT_BUCKET,
        s3Key: `smart-product-solution/${props.solutionVersion}/smart-product-notification-service.zip`
      },
      handler: 'index.handler',
      runtime: 'nodejs8.10',
      role: notificationServiceRole.roleArn,
      timeout: 300,
      memorySize: 256,
      environment: {
        variables: {
          SETTINGS_TBL: props.settingsTable.tableName,
          REGISTRATION_TBL: props.registrationTable.tableName,
          LOGGING_LEVEL: '2',
          IDP: props.userPool.userPoolId,
          SNS_TOPIC: notificationSnsTopic.topicName
        }
      }
    })

    const eventProxyRole = new iam.Role(this, 'EventProxyRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })
    const eventProxyService = new lambda.CfnFunction(this, 'EventProxy', {
      functionName: generateName(`${name}-EventProxyService`, 64),
      description: "Smart Product Solution event proxy microservice",
      code: {
        s3Bucket: process.env.BUILD_OUTPUT_BUCKET,
        s3Key: `smart-product-solution/${props.solutionVersion}/smart-product-event-proxy.zip`
      },
      handler: 'index.handler',
      runtime: 'nodejs8.10',
      role: eventProxyRole.roleArn,
      timeout: 60,
      memorySize: 256,
      environment: {
        variables: {
          EVENTS_TBL: props.eventsTable.tableName,
          REGISTRATION_TBL: props.registrationTable.tableName,
          LOGGING_LEVEL: '2',
          IDP: props.userPool.userPoolId,
          NOTIFICATION_LAMBDA: `${notificationService.functionName}`
        }
      }
    })

    const eventRule = new iot.CfnTopicRule(this, 'EventRule', {
      ruleName: "SmartProductEventRule",
      topicRulePayload: {
        actions: [{ lambda: { functionArn: eventProxyService.attrArn } }],
        description: 'Processing of event messages from smart products.',
        ruleDisabled: false,
        sql: `select * from '${props.eventTopic}/#'`
      }
    })

    //=============================================================================================
    // Permissions and Policies
    //=============================================================================================
    // Notification Log Policy
    const notificationLogPolicy = new iam.Policy(this, 'NotificationLogPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents'
        ],
        resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${notificationService.functionName}:*`]
      })]
    })
    const notificationLogPolicyResource = notificationLogPolicy.node.findChild('Resource') as iam.CfnPolicy;
    notificationLogPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${notificationServiceRole.roleName} to access its own logs.`
        }]
      }
    }
    notificationLogPolicy.attachToRole(notificationServiceRole);

    // Notification Dynamo Policy
    const notificationDynamoPolicy = new iam.Policy(this, 'NotificationDynamoPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            'dynamodb:GetItem'
          ],
          resources: [
            `${props.settingsTable.tableArn}`
          ]
        }),
        new iam.PolicyStatement({
          actions: [
            'dynamodb:Query'
          ],
          resources: [
            `${props.registrationTable.tableArn}`,
            `${props.registrationTable.tableArn}/index/deviceId-index`
          ]
        })
      ]
    })
    notificationDynamoPolicy.attachToRole(notificationServiceRole);

    // Notification Cognito Policy
    const notificationCognitoPolicy = new iam.Policy(this, 'NotificationCognitoPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'cognito-idp:ListUsers'
        ],
        resources: [`${props.userPool.userPoolArn}`]
      })]
    })
    notificationCognitoPolicy.attachToRole(notificationServiceRole);

    // Notification SNS Policy
    const notificationSnsPolicy = new iam.Policy(this, 'NotificationSnsPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'sns:Publish'
        ],
        resources: ['*'] // for phone numbers
      })]
    })
    const notificationSnsPolicyResource = notificationSnsPolicy.node.findChild('Resource') as iam.CfnPolicy;
    notificationSnsPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${notificationServiceRole.roleName} to publish notifications to users.`
        }]
      }
    }
    notificationSnsPolicy.attachToRole(notificationServiceRole);

    // Event Log Policy
    const eventLogPolicy = new iam.Policy(this, 'EventProxyLogPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents'
        ],
        resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${eventProxyService.functionName}:*`]
      })]
    })
    const eventLogPolicyResource = eventLogPolicy.node.findChild('Resource') as iam.CfnPolicy;
    eventLogPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${eventProxyRole.roleName} to access its own logs.`
        }]
      }
    }
    eventLogPolicy.attachToRole(eventProxyRole);

    // Event DynamoDB Policy
    const eventDynamoPolicy = new iam.Policy(this, 'EventProxyDynamoPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            'dynamodb:Query'
          ],
          resources: [
            `${props.registrationTable.tableArn}`,
            `${props.registrationTable.tableArn}/index/deviceId-index`
          ]
        }),
        new iam.PolicyStatement({
          actions: [
            'dynamodb:PutItem',
          ],
          resources: [
            `${props.eventsTable.tableArn}`,
          ]
        })
      ]
    })
    eventDynamoPolicy.attachToRole(eventProxyRole);

    // Event Lambda Policy
    const eventLambdaPolicy = new iam.Policy(this, 'EventProxyLambdaPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'lambda:InvokeFunction'
        ],
        resources: [notificationService.attrArn]
      })]
    })
    eventLambdaPolicy.attachToRole(eventProxyRole);

    new lambda.CfnPermission(this, 'LambdaInvokeEventProxyPermission', {
      functionName: `${eventProxyService.attrArn}`,
      action: 'lambda:InvokeFunction',
      principal: 'iot.amazonaws.com',
      sourceArn: `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/${eventRule.ruleName}`,
      sourceAccount: cdk.Aws.ACCOUNT_ID
    })
  }
}
