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

'use strict';

console.log('Loading function');

const url = require('url');
const requestPromise = require('request-promise');
const moment = require('moment');
const DynamoDBHelper = require('./lib/dynamodb-helper.js');
const S3Helper = require('./lib/s3-helper.js');
const IoTHelper = require('./lib/iot-helper.js');
const UsageMetrics = require('usage-metrics');
const uuidv4 = require('uuid/v4');

/**
 * Request handler.
 */
exports.handler = async (event, context, callback) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  let responseData = {};
  let responseSent = false;

  const properties = event.ResourceProperties;

  // Handling Promise Rejection
  process.on('unhandledRejection', error => {
    throw error;
  });

  try {
    /**
     * Check Requirements.
     * 1) If IoT Core may not be available in the region, throw error.
     * 2) If all parameters are "false", throw error.
     * 3) If related infrastructure is not deployed together, throw error.
     * 4) If the specific services may not be available in the region, throw error.
     */
    if (event.ResourceType === 'Custom::CheckRequirements') {
      /**
       * Check requirement when the solution is created or updated.
       */
      if (
        event.RequestType === 'Create'
        || event.RequestType === 'Update'
      ) {
        /**
         * Checks if IoT Core is supported.
         * If IoT Core is not available, throw error.
         */
        let _iotHelper = new IoTHelper();
        try {
          await _iotHelper.getIotEndpoint();
        } catch (error) {
          // Throws error if IoT Core may not be available in the region.
          console.error(`IoT Core may not be available in ${process.env.AWS_REGION} region.`, error);
          throw Error(`IoT Core may not be available in ${process.env.AWS_REGION} region.`);
        }

        /**
         * Checks parameters.
         * If all parameters are "false", throw error.
         */
        if (
          properties.DeploySmartProductTelemetry === 'false'
          && properties.DeploySmartProductEvent === 'false'
          && properties.DeploySmartProductJitr === 'false'
          && properties.DeploySmartProductApi === 'false'
          && properties.DeploySmartProductSampleOwnerWebApp === 'false'
          && properties.EnableSmartProductDefenderEnable === 'false'
        ) {
          // Throws error when nothing would be deploy.
          console.error('The solution will not deploy anything as you choose every parameter "false".');
          throw Error('The solution will not deploy anything as you choose every parameter "false".');
        }

        /**
         * If owner web app infrastructure would be deployed,
         * API infrastructure is required.
         * If not, throw error.
         */
        if (
          properties.DeploySmartProductSampleOwnerWebApp === 'true'
          && properties.DeploySmartProductApi === 'false'
        ) {
          // Throws error when API infrastructure is not deployed with owner web app.
          console.error('The owner web app should be deployed with API infrastructure.');
          throw Error('The owner web app should be deployed with API infrastructure.');
        }

        /**
         * If the telemetry infrastructure would be deployed,
         * 1) check if the telemetry topic parameter is empty.
         * 2) check if IoT Analytics is available in the region
         * If IoT Analytics may not be availalbe in the region or the topic is empty, throw error.
         */
        if (properties.DeploySmartProductTelemetry == 'true') {
          // Checks if the telemetry topic parameter is empty.
          if (properties.TelemetryTopic === '') {
            // Throws error if the telemetry topic parameter is empty.
            console.error('The telemetry topic parameter cannot be empty.');
            throw Error('The telemetry topic parameter cannot be empty.');
          }

          // Checks IoT Analytics availability
          try {
            await _iotHelper.getIotAnalyticsChannels();
          } catch (error) {
            // Throws error if IoT Analytics may not be available in the region.
            console.error(`IoT Analytics may not be available in ${process.env.AWS_REGION} region.`, error);
            throw Error(`IoT Analytics may not be available in ${process.env.AWS_REGION} region.`);
          }
        }

        /**
         * If the event infrastructure would be deployed,
         * check if the event topic parameter is empty.
         */
        if (properties.DeploySmartProductEvent == 'true') {
          if (properties.EventTopic === '') {
            // Throws error if the event topic parameter is empty.
            console.error('The event topic parameter cannot be empty.');
            throw Error('The event topic parameter cannot be empty.');
          }
        }

        /**
         * Checks if IoT Device Defender is available.
         * If IoT Device Defender may not be available in the region, throw error.
         */
        if (properties.EnableSmartProductDefenderEnable === 'true') {
          try {
            await _iotHelper.getAccountAuditConfiguration();
          } catch (error) {
            // Throws error if IoT Device Defender may not be available in the region.
            console.error(`IoT Device Defender may not be available in ${process.env.AWS_REGION} region.`, error);
            throw Error(`IoT Device Defender may not be available in ${process.env.AWS_REGION} region.`);
          }
        }

        /**
         * Creates a default thing type.
         */
        try {
          await _iotHelper.createThingType();
        } catch (error) {
          console.error('An error occurred while creating a thing type.', error);
          throw Error(error);
        }

        responseData = {
          Message: 'Success to finish checking requirements'
        };
      }
    }

    /**
     * Create solution UUID when the solution is created.
     */
    else if (
      event.ResourceType === 'Custom::CreateUuid'
      && event.RequestType === 'Create'
    ) {
      responseData = {
        UUID: uuidv4(),
      };
    }

    /**
     * Send annonymous metric.
     * Only when anonymous data is "true" to send when the solution is created or deleted.
     */
    else if (
      event.ResourceType === 'Custom::SendAnonymousMetric'
      && properties.AnonymousData === 'true'
    ) {
      if (
        event.RequestType === 'Create'
        || event.RequestType === 'Delete'
      ) {
        let _metric = {
          Solution: properties.SolutionId,
          UUID: properties.UUID,
          TimeStamp: moment().utc().format('YYYY-MM-DD HH:mm:ss.S'),
          Data: {
            Version: properties.Version,
            Launch: moment().utc().format(),
          },
        };

        let _usageMetrics = new UsageMetrics();
        try {
          await _usageMetrics.sendAnonymousMetric(_metric);
          responseData = {
            Message: 'Sending anonymous data successful.'
          };
        } catch (error) {
          // Throws error when sending anonymous launch metric fails.
          console.error('Sending anonymous launch metric failed.', error);
          responseData = {
            Message: 'Sending anonymous launch metric failed.'
          };
        }
      }
    }

    /**
     * Save DDB item
     */
    else if (event.ResourceType === 'Custom::SaveDdbItem') {
      if (event.RequestType === 'Create') {
        let _ddbHelper = new DynamoDBHelper();
        console.log(properties.DdbItem);
        try {
          responseData = await _ddbHelper.saveItem(properties.DdbItem, properties.DdbTable);
        } catch (error) {
          console.error(`Saving item to DyanmoDB table ${properties.DdbTable} failed.`, error);
          throw Error(`Saving item to DyanmoDB table ${properties.DdbTable} failed.`);
        }
      }
    }

    /**
     * Put Web config file to S3.
     * This is going to be executed When the solution is created or updated.
     */
    else if (event.ResourceType === 'Custom::PutConfigFile') {
      if (
        event.RequestType === 'Create'
        || event.RequestType === 'Update'
      ) {
        let _s3Helper = new S3Helper();
        console.log(properties.ConfigItem);
        try {
          responseData = _s3Helper.putConfigFile(properties.ConfigItem, properties.DestS3Bucket, properties.DestS3key);
        } catch (error) {
          // Throws error when saving config fail to S3 fails.
          console.error(`Saving config file to ${properties.DestS3Bucket}/${properties.DestS3key} failed.`, error);
          throw Error(`Saving config file to ${properties.DestS3Bucket}/${properties.DestS3key} failed.`);
        }
      }
    }

    /**
     * Copy Web S3 assets.
     */
    else if (
      event.ResourceType === 'Custom::CopyS3Assets'
      && event.RequestType === 'Create'
    ) {
      let _s3Helper = new S3Helper();

      try {
        await _s3Helper.copyAssets(properties.ManifestKey, properties.SourceS3Bucket, properties.SourceS3key, properties.DestS3Bucket);
        responseData = {
          Message: 'Copy web assets successful.'
        };
      } catch (error) {
        // Throws when copying of website asstes failes.
        console.error('Copy of website assets failed.', error);
        throw Error('Copy of website assets failed.');
      }
    }

    /**
     * Update IoT search index.
     * This is going to be execusted when the API infrastructure is deployed or deleted.
     */
    else if (event.ResourceType === 'Custom::UpdateIoTSearchIndex') {
      if (
        event.RequestType === 'Create'
        || event.RequestType === 'Delete'
      ) {
        let _iotHelper = new IoTHelper();
        try {
          responseData = await _iotHelper.updateIoTSearchIndex(event.RequestType);
        } catch (error) {
          // Throws error when updateIoTSearchIndex fails.
          console.error(`${event.RequestType} IoT search index failed.`, error);
          throw Error(`${event.RequestType} IoT search index failed.`);
        }
      }
    }

    /**
     * Enable IoT Device Defender.
     * This is going to be executed when the Device Defender is enabled or disabled.
     */
    else if (event.ResourceType === 'Custom::UpdateIoTDeviceDefender') {
      if (
        event.RequestType === 'Create'
        || event.RequestType === 'Delete'
      ) {
        let _iotHelper = new IoTHelper();
        let snsRoleArn = properties.SnsRoleArn;
        let snsTargetArn = properties.SnsTargetArn;
        let auditRoleArn = properties.AuditRoleArn;
        try {
          responseData = await _iotHelper.updateIoTDeviceDefender(event.RequestType, snsRoleArn, snsTargetArn, auditRoleArn);
        } catch (error) {
          // Throws error when updateIoTDeviceDefender fails.
          console.error(`${event.RequestType} IoT Device Defender configuration failed.`, error);
          throw Error(`${event.RequestType} IoT Device Defender configuration failed.`);
        }
      }
    }
  } catch (err) {
    console.log(`Error occurred while ${event.RequestType} ${event.ResourceType}:\n`, err);
    responseData = {
      Error: err.message,
    };
    await sendResponse(event, callback, context.logStreamName, 'FAILED', responseData);
    responseSent = true;
  } finally {
    if (!responseSent) {
      await sendResponse(event, callback, context.logStreamName, 'SUCCESS', responseData);
    }
  }
}

/**
 * Sends a response to the pre-signed S3 URL
 */
let sendResponse = async function (event, callback, logStreamName, responseStatus, responseData) {
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: `${JSON.stringify(responseData)}`,
    PhysicalResourceId: logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData,
  });

  console.log('RESPONSE BODY:\n', responseBody);
  const parsedUrl = url.parse(event.ResponseURL);
  const options = {
    uri: `https://${parsedUrl.hostname}${parsedUrl.path}`,
    port: 443,
    method: 'PUT',
    headers: {
      'Content-Type': '',
      'Content-Length': responseBody.length,
    },
    body: responseBody,
  };

  try {
    await requestPromise(options);
    console.log('Successfully sent stack response!');
    callback(null, 'Successfully sent stack response!');
  } catch (error) {
    console.log('sendResponse Error:', error);
    callback(error);
  }
};
