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
import s3 = require('@aws-cdk/aws-s3');
import cloudfront = require('@aws-cdk/aws-cloudfront');
import cfn = require('@aws-cdk/aws-cloudformation');
import cognito = require('@aws-cdk/aws-cognito');

export interface OwnerWebAppProps {
  helperFunction: cfn.CustomResourceProvider;
  helperFunctionRole: iam.Role;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  apiEndpoint: string;
  solutionVersion: string;
}

export class OwnerWebApp extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: OwnerWebAppProps) {
    super(scope, id);

    //=============================================================================================
    // Resources
    //=============================================================================================
    // S3 Bucket
    const smartProductWebsiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      websiteErrorDocument: 'index.html',
      websiteIndexDocument: 'index.html'
    })

    // Helper Function Policy
    const helperS3Policy = new iam.Policy(this, 'HelperS3Policy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [`${smartProductWebsiteBucket.bucketArn}/*`]
        }),
        new iam.PolicyStatement({
          actions: [
            's3:GetObject'
          ],
          resources: [`arn:aws:s3:::${process.env.BUILD_OUTPUT_BUCKET}/*`]
        })
      ]
    })
    const helperS3PolicyResource = helperS3Policy.node.findChild('Resource') as iam.CfnPolicy;
    helperS3PolicyResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W12',
          reason: `The * resource allows ${props.helperFunctionRole.roleName} to get and put objects to S3.`
        }]
      }
    }
    helperS3Policy.attachToRole(props.helperFunctionRole);

    const _copyS3Assets = new cfn.CustomResource(this, 'CopyS3Assets', {
      provider: props.helperFunction,
      resourceType: 'Custom::CopyS3Assets',
      properties: {
        Region: `${cdk.Aws.REGION}`,
        ManifestKey: `smart-product-solution/${props.solutionVersion}/site-manifest.json`,
        SourceS3Bucket: `${process.env.BUILD_OUTPUT_BUCKET}`,
        SourceS3key: `smart-product-solution/${props.solutionVersion}/console`,
        DestS3Bucket: smartProductWebsiteBucket.bucketName,
      }
    })
    _copyS3Assets.node.addDependency(helperS3Policy.node.findChild('Resource') as cdk.Resource)

    const _putConfig = new cfn.CustomResource(this, 'UploadWebConfig', {
      provider: props.helperFunction,
      resourceType: 'Custom::PutConfigFile',
      properties: {
        Region: `${cdk.Aws.REGION}`,
        CustomAction: 'putConfigFile',
        DestS3Bucket: smartProductWebsiteBucket.bucketName,
        DestS3key: 'assets/smart_product_config.js',
        ConfigItem: {
          aws_user_pools_id: props.userPool.userPoolId,
          aws_user_pools_web_client_id: props.userPoolClient.userPoolClientId,
          endpoint: props.apiEndpoint,
          region: `${cdk.Aws.REGION}`
        }
      }
    })
    _putConfig.node.addDependency(_copyS3Assets.node.findChild('Default') as cdk.Resource)
    _putConfig.node.addDependency(helperS3Policy.node.findChild('Resource') as cdk.Resource)

    const consoleOriginAccessIdentity = new cloudfront.CfnCloudFrontOriginAccessIdentity(this, 'ConsoleOriginAccessIdentity', {
      cloudFrontOriginAccessIdentityConfig: {
        comment: `access-identity-${smartProductWebsiteBucket.bucketName}`
      }
    })

    const consoleDistribution = new cloudfront.CloudFrontWebDistribution(this, 'ConsoleDistribution', {
      comment: 'Website distribution for smart product console',
      originConfigs: [{
        s3OriginSource: {
          s3BucketSource: smartProductWebsiteBucket,
          originAccessIdentityId: `${consoleOriginAccessIdentity.ref}`
        },
        behaviors: [{
          isDefaultBehavior: true,
          allowedMethods: cloudfront.CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CloudFrontAllowedCachedMethods.GET_HEAD_OPTIONS,
          defaultTtl: cdk.Duration.seconds(0),
          maxTtl: cdk.Duration.seconds(0),
          minTtl: cdk.Duration.seconds(0)
        }]
      }],
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      errorConfigurations: [
        {
          errorCode: 404,
          responseCode: 200,
          responsePagePath: '/index.html'
        },
        {
          errorCode: 403,
          responseCode: 200,
          responsePagePath: '/index.html'
        }
      ],
      enableIpV6: true,
      httpVersion: cloudfront.HttpVersion.HTTP2,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL
    })

    //=============================================================================================
    // Permissions and Policies
    //=============================================================================================
    // S3 Bucket Policy
    smartProductWebsiteBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      effect: iam.Effect.ALLOW,
      resources: [`${smartProductWebsiteBucket.bucketArn}/*`],
      principals: [new iam.CanonicalUserPrincipal(consoleOriginAccessIdentity.attrS3CanonicalUserId)]
    }))

    // CFN_NAG Annotations
    const websiteBucketResource = smartProductWebsiteBucket.node.findChild('Resource') as s3.CfnBucket;
    websiteBucketResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W35',
            reason: `SmartProductWebsiteBucket validated and does not require access logging to be configured.`
          },
          {
            id: 'W41',
            reason: 'SmartProductWebsiteBucket does not contain sensitive data so encryption is not needed.'
          }
        ]
      }
    }

    const websiteDistributionResource = consoleDistribution.node.findChild('CFDistribution') as cloudfront.CfnDistribution;
    websiteDistributionResource.cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [{
          id: 'W10',
          reason: `ConsoleDistribution validated and does not require access logging to be configured.`
        }]
      }
    }

    //=============================================================================================
    // Output
    //=============================================================================================
    new cdk.CfnOutput(this, 'OwnerWebAppConsole', {
      description: 'Smart Product Owner Web App Console URL',
      value: `https://${consoleDistribution.domainName}`
    })

    new cdk.CfnOutput(this, 'BucketName', {
      description: 'Smart Product Web Site Bucket',
      value: smartProductWebsiteBucket.bucketName
    })
  }
}