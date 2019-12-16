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
import dynamodb = require('@aws-cdk/aws-dynamodb');
import cognito = require('@aws-cdk/aws-cognito');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import cfn = require('@aws-cdk/aws-cloudformation');
import s3 = require('@aws-cdk/aws-s3');

import { SmartProductApi } from '../lib/smart-product-api';
import { SmartProductDeviceDefender } from '../lib/smart-product-device-defender';
import { SmartProductEvent } from '../lib/smart-product-event';
import { SmartProductJITR } from '../lib/smart-product-jitr';
import { OwnerWebApp } from '../lib/smart-product-owner-web-app';
import { SmartProductTelemetry } from '../lib/smart-product-telemetry';

import config from '../cdk-manifest.json';
const spConfig = (<any>config);
const solutionId = 'SO0046';

export class SmartProductSolutionStack extends cdk.Stack {
  private apiEndpoint: string;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //=============================================================================================
    // DynamoDB Tables
    //=============================================================================================
    // Setting Table
    const settingsTable = new dynamodb.Table(this, 'SmartProductSettingsTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      serverSideEncryption: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'settingId',
        type: dynamodb.AttributeType.STRING
      }
    })

    // Registration Table
    const registrationTable = new dynamodb.Table(this, 'SmartProductRegistrationTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      serverSideEncryption: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'deviceId',
        type: dynamodb.AttributeType.STRING
      }
    })

    registrationTable.addGlobalSecondaryIndex({
      indexName: 'deviceId-index',
      partitionKey: {
        name: 'deviceId',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    })

    registrationTable.addGlobalSecondaryIndex({
      indexName: 'userId-deviceName-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'deviceName',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    })

    // Command Table
    const commandTable = new dynamodb.Table(this, 'SmartProductCommandTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      serverSideEncryption: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'deviceId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'commandId',
        type: dynamodb.AttributeType.STRING
      }
    })

    commandTable.addGlobalSecondaryIndex({
      indexName: 'deviceId-updatedAt-index',
      partitionKey: {
        name: 'deviceId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'updatedAt',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    })

    // Event Table
    const eventsTable = new dynamodb.Table(this, 'SmartProductEventsTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      serverSideEncryption: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'deviceId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      }
    })

    eventsTable.addGlobalSecondaryIndex({
      indexName: 'userId-timestamp-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER
      },
      projectionType: dynamodb.ProjectionType.ALL
    })

    eventsTable.addGlobalSecondaryIndex({
      indexName: 'deviceId-timestamp-index',
      partitionKey: {
        name: 'deviceId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER
      },
      projectionType: dynamodb.ProjectionType.ALL
    })

    // Reference Table
    const referenceTable = new dynamodb.Table(this, 'SmartProductReferenceTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      serverSideEncryption: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'deviceId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'modelNumber',
        type: dynamodb.AttributeType.STRING
      }
    })

    //=============================================================================================
    //  Permissions and Policies
    //=============================================================================================
    // Helper Policy
    const helperPolicy = new iam.Policy(this, 'SmartProductHelperPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/*`]
        }),
        new iam.PolicyStatement({
          actions: [
            'iot:UpdateAccountAuditConfiguration',
            'iot:CreateScheduledAudit',
            'iot:DeleteAccountAuditConfiguration',
            'iot:DeleteScheduledAudit',
            'iot:DescribeEndpoint',
            'iot:DescribeAccountAuditConfiguration',
            'iotanalytics:ListChannels'
          ],
          resources: ['*']
        }),
        new iam.PolicyStatement({
          actions: [
            'iot:CreateThingType'
          ],
          resources: [`arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:thingtype/SmartProduct`]
        }),
        new iam.PolicyStatement({
          actions: [
            'iam:PassRole'
          ],
          resources: [`arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/*`]
        })
      ]
    })

    const helperPolicyResource = helperPolicy.node.findChild('Resource') as iam.CfnPolicy;
    helperPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows exchange information with solution resources.`
        }]
      }
    }

    // Cognito Helper Policy
    const cognitoHelperPolicy = new iam.Policy(this, 'SmartProductCognitoHelperPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/*`]
        }),
        new iam.PolicyStatement({
          actions: [
            'dynamodb:PutItem'
          ],
          resources: [`${settingsTable.tableArn}`]
        })
      ]
    })

    const congintoHelperPolicyResource = cognitoHelperPolicy.node.findChild('Resource') as iam.CfnPolicy;
    congintoHelperPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows to access its own logs.`
        }]
      }
    }

    //=============================================================================================
    // Helper Function
    //=============================================================================================
    const s3BuildOutputBucket = s3.Bucket.fromBucketArn(this, 'BuildOutputBucket', `arn:aws:s3:::${process.env.BUILD_OUTPUT_BUCKET}`);

    const smartProductHelperLambdaRole = new iam.Role(this, 'SmartProductHelperRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    })

    const smartProductHelperFunction = new lambda.SingletonFunction(this, 'SmartProductHelper', {
      uuid: 'helperFunction',
      functionName: 'SmartProductHelper',
      description: 'Smart Product Solution deployment helper',
      code: new lambda.S3Code(
        s3BuildOutputBucket,
        `smart-product-solution/${spConfig.default.version}/smart-product-helper.zip`
      ),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(300),
      memorySize: 256,
      role: smartProductHelperLambdaRole,
      environment: {
        LOGGING_LEVEL: '2'
      }
    })

    const smartProductCognitoHelperLambdaRole = new iam.Role(this, 'SmartProductCognitoHelperRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    })

    const smartProductCognitoHelperFunction = new lambda.Function(this, 'SmartProductCognitoHelper', {
      functionName: 'SmartProductCognitoHelper',
      description: 'Smart Product Solution Cognito trigger',
      code: new lambda.S3Code(
        s3BuildOutputBucket,
        `smart-product-solution/${spConfig.default.version}/smart-product-cognito.zip`
      ),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      role: smartProductCognitoHelperLambdaRole,
      timeout: cdk.Duration.seconds(60),
      memorySize: 128,
      environment: {
        SETTINGS_TBL: `${settingsTable.tableName}`,
        LOGGING_LEVEL: '2'
      }
    })

    smartProductCognitoHelperLambdaRole.attachInlinePolicy(cognitoHelperPolicy)
    smartProductHelperLambdaRole.attachInlinePolicy(helperPolicy)

    //=============================================================================================
    // Check Requirements Event
    //=============================================================================================
    const checkRquirements = new cfn.CustomResource(this, 'SmartProductCheckRequirements', {
      provider: cfn.CustomResourceProvider.lambda(smartProductHelperFunction),
      resourceType: 'Custom::CheckRequirements',
      properties: {
        Region: `${this.region}`,
        DeploySmartProductTelemetry: spConfig.default.telemetry.deploy,
        DeploySmartProductEvent: spConfig.default.events.deploy,
        DeploySmartProductJitr: spConfig.default.jitr.deploy,
        DeploySmartProductApi: spConfig.default.api.deploy,
        DeploySmartProductSampleOwnerWebApp: spConfig.default.ownerapp.deploy,
        EnableSmartProductDefenderEnable: spConfig.default.defender.deploy,
        TelemetryTopic: (spConfig.default.telemetry.deploy) ? (spConfig.default.telemetry.env.telemetryTopic) : (''),
        EventTopic: (spConfig.default.events.deploy) ? (spConfig.default.events.env.eventTopic) : ('')
      }
    })
    checkRquirements.node.addDependency(helperPolicy.node.findChild('Resource') as cdk.Resource)

    const appUuid = new cfn.CustomResource(this, 'SmartProductAppUuid', {
      provider: cfn.CustomResourceProvider.lambda(smartProductHelperFunction),
      resourceType: 'Custom::CreateUuid',
      properties: {
        Region: `${this.region}`
      }
    })
    appUuid.node.addDependency(helperPolicy.node.findChild('Resource') as cdk.Resource)

    //=============================================================================================
    // Cognito
    //=============================================================================================
    const userPool = new cognito.UserPool(this, 'SmartProductUserPool', {
      userPoolName: 'smart-product-pool',
      signInType: cognito.SignInType.EMAIL,
      autoVerifiedAttributes: [cognito.UserPoolAttribute.EMAIL],
      lambdaTriggers: {
        postConfirmation: smartProductCognitoHelperFunction
      }
    })

    const userPoolClient = new cognito.UserPoolClient(this, 'SmartProductAppClient', {
      userPool: userPool,
      userPoolClientName: 'smart-product-app',
      generateSecret: false
    })

    this.apiEndpoint = '';
    //=============================================================================================
    // API Constructor
    //=============================================================================================
    if (spConfig.default.api.deploy) {
      const smartProductApi = new SmartProductApi(this, 'SmartProductApi', {
        helperFunction: cfn.CustomResourceProvider.lambda(smartProductHelperFunction),
        helperFunctionRole: smartProductHelperLambdaRole,
        userPool: userPool,
        userPoolClient: userPoolClient,
        settingsTable: settingsTable,
        registrationTable: registrationTable,
        commandTable: commandTable,
        eventsTable: eventsTable,
        referenceTable: referenceTable,
        solutionVersion: spConfig.default.version,
        solutionId: solutionId,
        solutionUuid: appUuid.getAtt('UUID').toString(),
        anonymousData: `${spConfig.default.sendAnonymousUsage}`
      });

      this.apiEndpoint = smartProductApi.apiEndpoint;
    }

    //=============================================================================================
    // Device Defender Constructor
    //=============================================================================================
    if (spConfig.default.defender.deploy) {
      new SmartProductDeviceDefender(this, 'SmartProductDeviceDefender', {
        helperFunction: cfn.CustomResourceProvider.lambda(smartProductHelperFunction),
        helperFunctionPolicy: helperPolicy
      })
    }

    //=============================================================================================
    // Event Constructor
    //=============================================================================================
    if (spConfig.default.events.deploy) {
      new SmartProductEvent(this, 'SmartProductEvent', {
        eventsTable: eventsTable,
        registrationTable: registrationTable,
        userPool: userPool,
        settingsTable: settingsTable,
        solutionVersion: spConfig.default.version,
        eventTopic: spConfig.default.events.env.eventTopic
      })
    }

    //=============================================================================================
    // JITR Constructor
    //=============================================================================================
    if (spConfig.default.jitr.deploy) {
      new SmartProductJITR(this, 'SmartProductJITR', {
        spTelemetryTopic: (spConfig.default.telemetry.deploy) ? (spConfig.default.telemetry.env.telemetryTopic) : (''),
        spEventTopic: (spConfig.default.events.deploy) ? (spConfig.default.events.env.eventTopic) : (''),
        solutionVersion: spConfig.default.version,
        registrationTable: registrationTable,
        solutionId: solutionId,
        solutionUuid: appUuid.getAtt('UUID').toString(),
        anonymousData: `${spConfig.default.sendAnonymousUsage}`
      })
    }

    //=============================================================================================
    // Owner Web App Constructor
    //=============================================================================================
    if (spConfig.default.ownerapp.deploy && spConfig.default.api.deploy) {
      new OwnerWebApp(this, 'SmartProductOwnerWebApp', {
        helperFunction: cfn.CustomResourceProvider.lambda(smartProductHelperFunction),
        helperFunctionRole: smartProductHelperLambdaRole,
        userPool: userPool,
        userPoolClient: userPoolClient,
        apiEndpoint: this.apiEndpoint,
        solutionVersion: spConfig.default.version
      })
    }

    //=============================================================================================
    // Telemetry Constructor
    //=============================================================================================
    if (spConfig.default.telemetry.deploy) {
      new SmartProductTelemetry(this, 'SmartProductTelemetry', {
        telemetryTopic: spConfig.default.telemetry.env.telemetryTopic,
        solutionVersion: spConfig.default.version
      })
    }
  }
}
