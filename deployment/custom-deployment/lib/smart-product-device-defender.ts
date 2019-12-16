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
import sns = require('@aws-cdk/aws-sns');
import iam = require('@aws-cdk/aws-iam');
import cfn = require('@aws-cdk/aws-cloudformation');

export interface SmartProductDeviceDefenderProps {
	helperFunction: cfn.CustomResourceProvider;
	helperFunctionPolicy: iam.Policy;
}

export class SmartProductDeviceDefender extends cdk.Construct {
	public readonly response: string;

	constructor(parent: cdk.Construct, name: string, props: SmartProductDeviceDefenderProps) {
		super(parent, name);

		//=============================================================================================
		// Resources
		//=============================================================================================
		const deviceDefenderSNS = new sns.Topic(this, 'SNS', {
			displayName: "SmartProductDeviceDefenderSNS",
			topicName: "SmartProductDeviceDefenderSNS"
		})

		const auditNotifyRole = new iam.Role(this, 'AuditNotifyRole', {
			assumedBy: new iam.ServicePrincipal('iot.amazonaws.com')
		})

		const auditNotifyPolicy = new iam.Policy(this, 'AuditNotifyPolicy', {
			statements: [new iam.PolicyStatement({
				actions: [
					'iot:GetLoggingOptions',
					'iot:GetV2LoggingOptions',
					'iot:ListCACertificates',
					'iot:ListCertificates',
					'iot:DescribeCACertificate',
					'iot:DescribeCertificate',
					'iot:ListPolicies',
					'iot:GetPolicy',
					'iot:GetEffectivePolicies',
					'cognito-identity:GetIdentityPoolRoles',
					'iam:ListRolePolicies',
					'iam:ListAttachedRolePolicies',
					'iam:GetPolicy',
					'iam:GetPolicyVersion',
					'iam:GetRolePolicy'
				],
				resources: [`*`]
			}),
			new iam.PolicyStatement({
				actions: ['sns:Publish'],
				resources: [deviceDefenderSNS.topicArn]
			})]
		})
		const auditNotifyPolicyResource = auditNotifyPolicy.node.findChild('Resource') as iam.CfnPolicy;
		auditNotifyPolicyResource.cfnOptions.metadata = {
			cfn_nag: {
				rules_to_suppress: [{
					id: 'W12',
					reason: `The * resource allows ${auditNotifyRole.roleName} to audit IoT devices.`
				}]
			}
		}
		auditNotifyPolicy.attachToRole(auditNotifyRole);

		const _updateDefender = new cfn.CustomResource(this, 'UpdateIoTDeviceDefender', {
			provider: props.helperFunction,
			resourceType: 'Custom::UpdateIoTDeviceDefender',
			properties: {
				Region: `${cdk.Aws.REGION}`,
				CustomAction: 'updateIoTDeviceDefender',
				SnsRoleArn: auditNotifyRole.roleArn,
				SnsTargetArn: deviceDefenderSNS.topicArn,
				AuditRoleArn: auditNotifyRole.roleArn
			}
		})
		_updateDefender.node.addDependency(auditNotifyPolicy.node.findChild('Resource') as cdk.Resource)
		_updateDefender.node.addDependency(props.helperFunctionPolicy.node.findChild('Resource') as cdk.Resource)

	}
}
