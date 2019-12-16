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
import iam = require('@aws-cdk/aws-iam');
import cfn = require('@aws-cdk/aws-cloudformation');
import cognito = require('@aws-cdk/aws-cognito');
import dynamodb = require('@aws-cdk/aws-dynamodb');
import lambda = require('@aws-cdk/aws-lambda');
import iot = require('@aws-cdk/aws-iot');
import apigateway = require('@aws-cdk/aws-apigateway');
import s3 = require('@aws-cdk/aws-s3');

export interface ApiProps {
  helperFunction: cfn.CustomResourceProvider;
  helperFunctionRole: iam.Role;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  settingsTable: dynamodb.Table;
  registrationTable: dynamodb.Table;
  commandTable: dynamodb.Table;
  eventsTable: dynamodb.Table;
  referenceTable: dynamodb.Table;
  solutionVersion: string;
  solutionId: string;
  solutionUuid: string;
  anonymousData: string;
}

export interface IMethodResource {
  apiResource: apigateway.IResource;
  lambdaFunction: lambda.Function;
}

export function addMethod(resources: IMethodResource[], apiLambdaExecRole: iam.Role, authorizerId: string, apiDeployment: apigateway.Deployment) {
  for (let resource of resources) {
    let { apiResource, lambdaFunction } = resource;
    let options = apiResource.addMethod('OPTIONS',
      new apigateway.MockIntegration({
        integrationResponses: [{
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Methods': "'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT'"
          },
        }],
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
        credentialsRole: apiLambdaExecRole,
        requestTemplates: {
          "application/json": "{\"statusCode\": 200}"
        },
      }), {
        methodResponses: [{
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Origin': true
          },
        }]
      }
    );

    let anyMethod = apiResource.addMethod('ANY', new apigateway.LambdaIntegration(lambdaFunction), {
      authorizer: { authorizerId },
      authorizationType: apigateway.AuthorizationType.COGNITO
    });

    apiDeployment.node.addDependency(apiResource.node.findChild('Resource') as cdk.Resource);
    apiDeployment.node.addDependency(options.node.findChild('Resource') as cdk.Resource);
    apiDeployment.node.addDependency(anyMethod.node.findChild('Resource') as cdk.Resource);
  }
}

export class SmartProductApi extends cdk.Construct {
  public readonly apiEndpoint: string;

  constructor(parent: cdk.Construct, name: string, props: ApiProps) {
    super(parent, name);

    //=============================================================================================
    // Resources
    //=============================================================================================
    //---------------------------------------------------------------------------------------------
    // Custom Resource
    //---------------------------------------------------------------------------------------------
    // Helper IoT Search Index Policy
    const helperIoTSearchIndexPolicy = new iam.Policy(this, 'HelperIoTSearchIndexPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'iot:UpdateIndexingConfiguration'
        ],
        resources: ['*']
      })]
    })
    const helperIoTSearchIndexPolicyResource = helperIoTSearchIndexPolicy.node.findChild('Resource') as iam.CfnPolicy;
    helperIoTSearchIndexPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${props.helperFunctionRole.roleName} to update IoT Search Index.`
        }]
      }
    }
    helperIoTSearchIndexPolicy.attachToRole(props.helperFunctionRole);

    const _updateIoTSearchIndex = new cfn.CustomResource(this, 'UpdateIoTSearchIndex', {
      provider: props.helperFunction,
      resourceType: 'Custom::UpdateIoTSearchIndex',
      properties: {
        Region: `${cdk.Aws.REGION}`,
        CustomAction: 'updateIoTSearchIndex'
      }
    })
    _updateIoTSearchIndex.node.addDependency(helperIoTSearchIndexPolicy.node.findChild('Resource') as cdk.Resource)

    // Helper DynamoDB Policy
    const helperDynamoDBPolicy = new iam.Policy(this, 'helperDynamoDBPolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'dynamodb:PutItem'
        ],
        resources: [`${props.settingsTable.tableArn}`]
      })]
    })
    helperDynamoDBPolicy.attachToRole(props.helperFunctionRole);

    const _saveDDBItem = new cfn.CustomResource(this, 'SaveDdbItem', {
      provider: props.helperFunction,
      resourceType: 'Custom::SaveDdbItem',
      properties: {
        Region: `${cdk.Aws.REGION}`,
        CustomAction: 'SaveDdbItem',
        ddbTable: props.settingsTable.tableName,
        ddbItem: {
          settingId: 'app-config',
          setting: {
            idp: props.userPool.userPoolId
          }
        }
      }
    })
    _saveDDBItem.node.addDependency(helperDynamoDBPolicy.node.findChild('Resource') as cdk.Resource)

    //---------------------------------------------------------------------------------------------
    // Microservices
    //---------------------------------------------------------------------------------------------
    // admin - SmartProductAdminRole
    const adminServiceRole = new iam.Role(this, 'AdminServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })
    const adminService = new lambda.Function(this, 'AdminService', {
      functionName: "SmartProductAPI-AdminService",
      description: "Smart Product administration API microservice",
      code: new lambda.S3Code(
        s3.Bucket.fromBucketArn(this, 'AdminBuildOutputBucket', `arn:aws:s3:::${process.env.BUILD_OUTPUT_BUCKET}`),
        `smart-product-solution/${props.solutionVersion}/smart-product-admin-service.zip`
      ),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      role: adminServiceRole,
      environment: {
        LOGGING_LEVEL: '2',
        IDP: props.userPool.userPoolId,
        SETTINGS_TBL: props.settingsTable.tableName
      },
    })

    // registration - SmartProductRegistrationRole
    const registrationServiceRole = new iam.Role(this, 'RegistrationServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })
    const registrationService = new lambda.Function(this, 'RegistrationService', {
      functionName: "SmartProductAPI-RegistrationService",
      description: "Smart Product Solution registration API microservice",
      code: new lambda.S3Code(
        s3.Bucket.fromBucketArn(this, 'RegistrationBuildOutputBucket', `arn:aws:s3:::${process.env.BUILD_OUTPUT_BUCKET}`),
        `smart-product-solution/${props.solutionVersion}/smart-product-registration-service.zip`
      ),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      role: registrationServiceRole,
      environment: {
        LOGGING_LEVEL: '2',
        IDP: props.userPool.userPoolId,
        REGISTRATION_TBL: props.registrationTable.tableName,
        REFERENCE_TBL: props.referenceTable.tableName,
        THING_TYPE: 'SmartProduct',
        solutionId: props.solutionId,
        solutionUuid: props.solutionUuid,
        anonymousData: props.anonymousData
      }
    })

    // event - SmartProductEventRole
    const eventServiceRole = new iam.Role(this, 'EventServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })
    const eventService = new lambda.Function(this, 'EventService', {
      functionName: "SmartProductAPI-EventService",
      description: "Smart Product Solution event API microservice",
      code: new lambda.S3Code(
        s3.Bucket.fromBucketArn(this, 'EventBuildOutputBucket', `arn:aws:s3:::${process.env.BUILD_OUTPUT_BUCKET}`),
        `smart-product-solution/${props.solutionVersion}/smart-product-event-service.zip`
      ),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      role: eventServiceRole,
      environment: {
        LOGGING_LEVEL: '2',
        IDP: props.userPool.userPoolId,
        SETTINGS_TBL: props.settingsTable.tableName,
        REGISTRATION_TBL: props.registrationTable.tableName,
        EVENTS_TBL: props.eventsTable.tableName
      }
    })

    // Command - SmartProductCommandRole
    const commandServiceRole = new iam.Role(this, 'CommandServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })
    const commandService = new lambda.Function(this, 'CommandService', {
      functionName: "SmartProductAPI-CommandService",
      description: "Smart Product Solution command API microservice",
      code: new lambda.S3Code(
        s3.Bucket.fromBucketArn(this, 'CommandBuildOutputBucket', `arn:aws:s3:::${process.env.BUILD_OUTPUT_BUCKET}`),
        `smart-product-solution/${props.solutionVersion}/smart-product-command-service.zip`
      ),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(300),
      memorySize: 256,
      role: commandServiceRole,
      environment: {
        LOGGING_LEVEL: '2',
        IDP: props.userPool.userPoolId,
        REGISTRATION_TBL: props.registrationTable.tableName,
        COMMANDS_TBL: props.commandTable.tableName,
        solutionId: props.solutionId,
        solutionUuid: props.solutionUuid,
        anonymousData: props.anonymousData
      }
    })

    // Status - SmartProductStatusRole
    const statusServiceRole = new iam.Role(this, 'StatusServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })
    const statusService = new lambda.Function(this, 'StatusService', {
      functionName: "SmartProductAPI-StatusService",
      description: "Smart Product Solution status API microservice",
      code: new lambda.S3Code(
        s3.Bucket.fromBucketArn(this, 'StatusBuildOutputBucket', `arn:aws:s3:::${process.env.BUILD_OUTPUT_BUCKET}`),
        `smart-product-solution/${props.solutionVersion}/smart-product-status-service.zip`
      ),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(300),
      memorySize: 256,
      role: statusServiceRole,
      environment: {
        LOGGING_LEVEL: '2',
        IDP: props.userPool.userPoolId,
        REGISTRATION_TBL: props.registrationTable.tableName
      }
    })

    // Device - SmartProductDeviceRole
    const deviceServiceRole = new iam.Role(this, 'DeviceServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })
    const deviceService = new lambda.Function(this, 'DeviceService', {
      functionName: "SmartProductAPI-DeviceService",
      description: "Smart Product Solution device microservice",
      code: new lambda.S3Code(
        s3.Bucket.fromBucketArn(this, 'DeviceBuildOutputBucket', `arn:aws:s3:::${process.env.BUILD_OUTPUT_BUCKET}`),
        `smart-product-solution/${props.solutionVersion}/smart-product-device-service.zip`
      ),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      role: deviceServiceRole,
      environment: {
        LOGGING_LEVEL: '2',
        IDP: props.userPool.userPoolId,
        REGISTRATION_TBL: props.registrationTable.tableName
      }
    })

    // Command Status
    const commandStatusService = new lambda.Function(this, 'CommandStatusService', {
      functionName: "SmartProductAPI-CommandStatusService",
      description: "Smart Product Solution command status microservice",
      code: new lambda.S3Code(
        s3.Bucket.fromBucketArn(this, 'CommandStatusBuildOutputBucket', `arn:aws:s3:::${process.env.BUILD_OUTPUT_BUCKET}`),
        `smart-product-solution/${props.solutionVersion}/smart-product-command-status.zip`
      ),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      role: commandServiceRole,
      environment: {
        LOGGING_LEVEL: '2',
        COMMANDS_TBL: props.commandTable.tableName
      }
    })

    //---------------------------------------------------------------------------------------------
    // API Gateway
    //---------------------------------------------------------------------------------------------
    const apiLambdaExecRole = new iam.Role(this, 'ApiLambdaExecRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
    })

    const api = new apigateway.RestApi(this, 'smart-product-api', {
      restApiName: 'SmartProductAPI',
      deploy: false,
    });

    const apiDeployment = new apigateway.Deployment(this, 'Deployment', {
      api,
      description: 'Production'
    });
    const apiDeploymentResource = apiDeployment.node.findChild('Resource') as apigateway.CfnDeployment;
    apiDeploymentResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W45',
          reason: 'The access logging is enabled at API Gateway stage.'
        }]
      }
    };
    api.deploymentStage = new apigateway.Stage(this, 'Stage', {
      deployment: apiDeployment,
      description: 'Smart Product Stage',
      stageName: 'prod'
    });
    const apiStageResource = api.deploymentStage.node.findChild('Resource') as apigateway.CfnStage;
    apiStageResource.addPropertyOverride('AccessLogSetting', {
      DestinationArn: `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:API-Gateway-Execution-Logs_${api.restApiId}/prod`,
      Format: `{ "requestId": "$context.requestId",
        "ip": "$context.identity.sourceIp",
        "caller": "$context.identity.caller",
        "user": "$context.identity.user",
        "userAgent": "$context.identity.userAgent",
        "requestTime": "$context.requestTime",
        "httpMethod": "$context.httpMethod",
        "resourcePath": "$context.resourcePath",
        "status": "$context.status",
        "protocol": "$context.protocol",
        "responseLength": "$context.responseLength"
      }`.replace(/\n/g, '')
    });

    const authorizer = new apigateway.CfnAuthorizer(this, 'Authorizer', {
      identitySource: 'method.request.header.Authorization',
      name: 'Authorization',
      type: 'COGNITO_USER_POOLS',
      providerArns: [props.userPool.userPoolArn],
      restApiId: api.restApiId
    });

    const adminRes = api.root.addResource("admin");
    apiDeployment.node.addDependency(adminRes.node.findChild('Resource') as cdk.Resource);

    //admin/settings/config/{settingId}
    const configRes = adminRes.addResource("settings").addResource("config").addResource("{settingId}");

    //registration
    const registrationRes = api.root.addResource("registration");

    //devices
    const devicesRes = api.root.addResource("devices");

    //devices/events
    const eventsRes = devicesRes.addResource("events");

    //devices/alerts
    const alertsRes = devicesRes.addResource("alerts");

    //devices/alerts/count
    const countRes = alertsRes.addResource("count");

    //devices/{deviceId}
    const deviceRes = devicesRes.addResource("{deviceId}");

    //devices/{deviceId}/commands
    const commandsRes = deviceRes.addResource("commands");

    //devices/{deviceId}/commands/{commandId}
    const commandRes = commandsRes.addResource("{commandId}");

    //devices/{deviceId}/events
    const deviceEventsRes = deviceRes.addResource("events");

    //devices/{deviceId}/events/{eventId}
    const deviceEventRes = deviceEventsRes.addResource("{eventId}");

    //devices/{deviceId}/status
    const statusRes = deviceRes.addResource("status");

    addMethod(
      [
        { apiResource: configRes, lambdaFunction: adminService},
        { apiResource: registrationRes, lambdaFunction: registrationService},
        { apiResource: devicesRes, lambdaFunction: deviceService},
        { apiResource: eventsRes, lambdaFunction: eventService},
        { apiResource: alertsRes, lambdaFunction: eventService},
        { apiResource: countRes, lambdaFunction: eventService},
        { apiResource: deviceRes, lambdaFunction: deviceService},
        { apiResource: commandsRes, lambdaFunction: commandService},
        { apiResource: commandRes, lambdaFunction: commandService},
        { apiResource: deviceEventsRes, lambdaFunction: eventService},
        { apiResource: deviceEventRes, lambdaFunction: eventService},
        { apiResource: statusRes, lambdaFunction: statusService}
      ]
      , apiLambdaExecRole, authorizer.ref, apiDeployment);

    //---------------------------------------------------------------------------------------------
    // Others
    //---------------------------------------------------------------------------------------------
    const commandStatusRule = new iot.CfnTopicRule(this, 'CommandStatusRule', {
      ruleName: "SmartProductCommandStatusRule",
      topicRulePayload: {
        actions: [{ lambda: { functionArn: commandStatusService.functionArn } }],
        description: 'Command status for Smart Product Solution.',
        ruleDisabled: false,
        sql: `select * from 'smartproduct/commands/#'`
      }
    })

    //=============================================================================================
    // Permissions and Policies
    //=============================================================================================
    const apiLambdaExecPolicy = new iam.Policy(this, 'apiLambdaExecPolicy', {
      statements: [new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [
          adminService.functionArn,
          registrationService.functionArn,
          commandService.functionArn,
          statusService.functionArn,
          eventService.functionArn,
          deviceService.functionArn
        ]
      })]
    })
    apiLambdaExecPolicy.attachToRole(apiLambdaExecRole);

    new lambda.CfnPermission(this, 'LambdaInvokeCommandStatusPermission', {
      functionName: `${commandStatusService.functionArn}`,
      action: 'lambda:InvokeFunction',
      principal: 'iot.amazonaws.com',
      sourceArn: `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/${commandStatusRule.ruleName}`,
      sourceAccount: cdk.Aws.ACCOUNT_ID
    })

    //---------------------------------------------------------------------------------------------
    // Registration
    //---------------------------------------------------------------------------------------------
    const registrationPolicy = new iam.Policy(this, 'registrationPolicy', {
      statements: [
        // Logs
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${registrationService.functionName}:*`]
        }),

        // DynamoDB
        new iam.PolicyStatement({
          actions: [
            'dynamodb:DeleteItem',
            'dynamodb:PutItem',
            'dynamodb:Query'
          ],
          resources: [
            `${props.registrationTable.tableArn}`,
            `${props.registrationTable.tableArn}/index/userId-deviceName-index`,
            `${props.registrationTable.tableArn}/index/deviceId-index`
          ]
        }),
        new iam.PolicyStatement({
          actions: ['dynamodb:GetItem'],
          resources: [`${props.referenceTable.tableArn}`]
        }),

        // Cognito
        new iam.PolicyStatement({
          actions: [
            'cognito-idp:AdminGetUser',
            'cognito-idp:AdminListGroupsForUser'
          ],
          resources: [`${props.userPool.userPoolArn}`]
        }),

        // IoT
        new iam.PolicyStatement({
          actions: ['iot:CreateThing'],
          resources: [`arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:thing/*`]
        })
      ]
    })
    const registrationPolicyResource = registrationPolicy.node.findChild('Resource') as iam.CfnPolicy;
    registrationPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${registrationServiceRole.roleName} to access its own logs and create things.`
        }]
      }
    }
    registrationPolicy.attachToRole(registrationServiceRole);

    //---------------------------------------------------------------------------------------------
    // Admin
    //---------------------------------------------------------------------------------------------
    const adminPolicy = new iam.Policy(this, 'AdminPolicy', {
      statements: [
        // Logs
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${adminService.functionName}:*`]
        }),

        // DynamoDB
        new iam.PolicyStatement({
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem'
          ],
          resources: [`${props.settingsTable.tableArn}`]
        }),

        // Cognito
        new iam.PolicyStatement({
          actions: [
            'cognito-idp:AdminGetUser',
            'cognito-idp:AdminListGroupsForUser'
          ],
          resources: [`${props.userPool.userPoolArn}`]
        })
      ]
    })
    const adminPolicyResource = adminPolicy.node.findChild('Resource') as iam.CfnPolicy;
    adminPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${adminServiceRole.roleName} to access its own logs.`
        }]
      }
    }
    adminPolicy.attachToRole(adminServiceRole);

    //---------------------------------------------------------------------------------------------
    // Event
    //---------------------------------------------------------------------------------------------
    const eventPolicy = new iam.Policy(this, 'EventPolicy', {
      statements: [
        // Logs
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${eventService.functionName}:*`]
        }),

        // DynamoDB
        new iam.PolicyStatement({
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:Query'
          ],
          resources: [
            `${props.eventsTable.tableArn}`,
            `${props.eventsTable.tableArn}/index/userId-timestamp-index`,
            `${props.eventsTable.tableArn}/index/deviceId-timestamp-index`
          ]
        }),
        new iam.PolicyStatement({
          actions: ['dynamodb:GetItem'],
          resources: [`${props.settingsTable.tableArn}`]
        }),
        new iam.PolicyStatement({
          actions: [
            'dynamodb:Query',
            'dynamodb:GetItem'
          ],
          resources: [`${props.registrationTable.tableArn}`]
        }),

        // Cognito
        new iam.PolicyStatement({
          actions: [
            'cognito-idp:AdminGetUser',
            'cognito-idp:AdminListGroupsForUser'
          ],
          resources: [`${props.userPool.userPoolArn}`]
        })
      ]
    })
    const eventPolicyResource = eventPolicy.node.findChild('Resource') as iam.CfnPolicy;
    eventPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${eventServiceRole.roleName} to access its own logs.`
        }]
      }
    }
    eventPolicy.attachToRole(eventServiceRole);

    //---------------------------------------------------------------------------------------------
    // Command
    //---------------------------------------------------------------------------------------------
    const commandPolicy = new iam.Policy(this, 'CommandPolicy', {
      statements: [
        // Logs
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: [
            `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${commandService.functionName}:*`,
            `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${commandStatusService.functionName}:*`
          ]
        }),

        // DynamoDB
        new iam.PolicyStatement({
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:Query',
            'dynamodb:UpdateItem'
          ],
          resources: [
            `${props.commandTable.tableArn}`,
            `${props.commandTable.tableArn}/index/deviceId-updatedAt-index`
          ]
        }),
        new iam.PolicyStatement({
          actions: ['dynamodb:GetItem'],
          resources: [`${props.registrationTable.tableArn}`]
        }),

        // Cognito
        new iam.PolicyStatement({
          actions: [
            'cognito-idp:AdminGetUser',
            'cognito-idp:AdminListGroupsForUser'
          ],
          resources: [`${props.userPool.userPoolArn}`]
        }),

        // IoT
        new iam.PolicyStatement({
          actions: [
            'iot:DescribeEndpoint',
            'iot:GetThingShadow',
            'iot:UpdateThingShadow',
            'iot:Publish',
          ],
          resources: [`*`]
        })
      ]
    })
    const commandPolicyResource = commandPolicy.node.findChild('Resource') as iam.CfnPolicy;
    commandPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${commandServiceRole.roleName} to access its own logs and exchange information with IoT devices.`
        }]
      }
    }
    commandPolicy.attachToRole(commandServiceRole);

    //---------------------------------------------------------------------------------------------
    // Status
    //---------------------------------------------------------------------------------------------
    const statusPolicy = new iam.Policy(this, 'StatusPolicy', {
      statements: [
        // Logs
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${statusService.functionName}:*`]
        }),

        // DynamoDB
        new iam.PolicyStatement({
          actions: ['dynamodb:GetItem'],
          resources: [`${props.registrationTable.tableArn}`]
        }),

        // Cognito
        new iam.PolicyStatement({
          actions: [
            'cognito-idp:AdminGetUser',
            'cognito-idp:AdminListGroupsForUser'
          ],
          resources: [`${props.userPool.userPoolArn}`]
        }),

        // IoT
        new iam.PolicyStatement({
          actions: [
            'iot:DescribeEndpoint',
            'iot:GetThingShadow',
            'iot:SearchIndex'
          ],
          resources: [`*`]
        })
      ]
    })
    const statusPolicyResource = statusPolicy.node.findChild('Resource') as iam.CfnPolicy;
    statusPolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${statusServiceRole.roleName} to access its own logs and exchange information with IoT devices.`
        }]
      }
    }
    statusPolicy.attachToRole(statusServiceRole);

    //---------------------------------------------------------------------------------------------
    // Device
    //---------------------------------------------------------------------------------------------
    const devicePolicy = new iam.Policy(this, 'DevicePolicy', {
      statements: [
        // Logs
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${deviceService.functionName}:*`]
        }),

        // DynamoDB
        new iam.PolicyStatement({
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem'
          ],
          resources: [`${props.registrationTable.tableArn}`]
        }),

        // Cognito
        new iam.PolicyStatement({
          actions: [
            'cognito-idp:AdminGetUser',
            'cognito-idp:AdminListGroupsForUser'
          ],
          resources: [`${props.userPool.userPoolArn}`]
        }),

        // IoT
        new iam.PolicyStatement({
          actions: [
            'iot:SearchIndex',
            'iot:DescribeIndex'
          ],
          resources: [`arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:index/AWS_Things`]
        }), new iam.PolicyStatement({
          actions: [
            'iot:DeleteThing',
            'iot:DescribeThing',
            'iot:ListThingPrincipals'
          ],
          resources: [`arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:thing/*`]
        }), new iam.PolicyStatement({
          actions: [
            'iot:DeletePolicy'
          ],
          resources: [`arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:policy/*`]
        }), new iam.PolicyStatement({
          actions: [
            'iot:DetachThingPrincipal',
            'iot:DeleteCertificate',
            'iot:UpdateCertificate'
          ],
          resources: [`arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:cert/*`]
        })
      ]
    })
    const devicePolicyResource = devicePolicy.node.findChild('Resource') as iam.CfnPolicy;
    devicePolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${deviceServiceRole.roleName} to access its own logs and exchange information with IoT devices.`
        }]
      }
    }
    devicePolicy.attachToRole(deviceServiceRole);

    //=============================================================================================
    // Output
    //=============================================================================================
    this.apiEndpoint = api.url;
    new cdk.CfnOutput(this, 'APIEndpoint', {
      description: 'Smart Product API Endpoint',
      value: api.url
    })
  }
}