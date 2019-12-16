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

/**
 * @author Solution Builders
 */

'use strict';

/**
This node.js Lambda function code creates and attaches an IoT policy to the
just-in-time registered certificate. It also activates the certificate. The Lambda
function is invoked as a rule engine action to the registration topic
$aws/events/certificates/registered/<caCertificateID>
**/

const Logger = require('logger');
const JITRHelper = require('./jitrHelper');
const moment = require('moment');
const UsageMetrics = require('usage-metrics');

const respond = async event => {
  // Replace it with the AWS region the lambda will be running in
  const region = process.env.AWS_REGION;

  const accountId = event.awsAccountId.toString().trim();

  const certificateId = event.certificateId.toString().trim();

  // Replace it with your desired topic prefix
  const telemetryTopic = process.env.TELEMETRY_TOPIC; //for telemetry data
  const eventTopic = process.env.EVENT_TOPIC; //for device events
  const commandTopic = 'smartproduct/commands'; //for device responses to commands

  const certificateARN = `arn:aws:iot:${region}:${accountId}:cert/${certificateId}`;
  const policyName = `${certificateId}`;

  // Policy that allows connect, publish, subscribe and receive
  const iotThingName = '${iot:Connection.Thing.ThingName}';
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['iot:Connect'],
        Resource: `arn:aws:iot:${region}:${accountId}:client/${iotThingName}`,
      },
      {
        Effect: 'Allow',
        Action: [
          'iot:GetThingShadow',
          'iot:UpdateThingShadow',
        ],
        Resource: `arn:aws:iot:${region}:${accountId}:thing/${iotThingName}`
      },
      {
        Effect: 'Allow',
        Action: ['iot:Publish'],
        Resource: [
          `arn:aws:iot:${region}:${accountId}:topic/${telemetryTopic}/${iotThingName}`,
          `arn:aws:iot:${region}:${accountId}:topic/${eventTopic}/${iotThingName}`,
          `arn:aws:iot:${region}:${accountId}:topic/${commandTopic}/${iotThingName}`,
          `arn:aws:iot:${region}:${accountId}:topic/$aws/things/${iotThingName}/shadow/*`,
        ],
      },
      {
        Effect: 'Allow',
        Action: ['iot:Subscribe'],
        Resource: [
          `arn:aws:iot:${region}:${accountId}:topicfilter/$aws/things/${iotThingName}/shadow/*`,
          `arn:aws:iot:${region}:${accountId}:topicfilter/${commandTopic}/${iotThingName}`,
        ],
      },
      {
        Effect: 'Allow',
        Action: ['iot:Receive'],
        Resource: [
          `arn:aws:iot:${region}:${accountId}:topic/$aws/things/${iotThingName}/shadow/*`,
          `arn:aws:iot:${region}:${accountId}:topic/${commandTopic}/${iotThingName}`,
        ],
      },
    ],
  };

  const _jitrHelper = new JITRHelper();

  /*
   * Create and attach policy
   */
  try {
    await _jitrHelper.attachPolicy(
      JSON.stringify(policy),
      policyName,
      certificateARN
    );
    /*
     * Attach thing to certificate
     */
    await _jitrHelper.attachThing(certificateId, certificateARN);

    // Sends anonymous metric data
    const anonymousData = process.env.anonymousData;
    const solutionId = process.env.solutionId;
    const solutionUuid = process.env.solutionUuid;

    if (anonymousData === 'true') {
      let metric = {
        Solution: solutionId,
        UUID: solutionUuid,
        Timestamp: moment().utc().format('YYYY-MM-DD HH:mm:ss.S'),
        Registrations: 1,
      };

      let usageMetrics = new UsageMetrics();
      try {
        await usageMetrics.sendAnonymousMetric(metric);
      } catch (e) {
        Logger.error(Logger.levels.INFO, e);
      }
    }
  } catch (e) {
    Logger.error(Logger.levels.INFO, e);
    throw new Error(e);
  }
};

module.exports = {
  respond,
};
