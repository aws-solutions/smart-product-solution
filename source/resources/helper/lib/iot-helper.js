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

let AWS = require('aws-sdk');
const Logger = require('logger');

/**
 * Helper function to interact with AWS IoT for cfn custom resource.
 *
 * @class iotHelper
 */
class iotHelper {
  /**
   * @class iotHelper
   * @constructor
   */
  constructor() {
    this.creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
  }

  /**
   * Gettting IoT Endpoint to check IoT Core availability
   */
  getIotEndpoint() {
    Logger.log(
      Logger.levels.ROBUST,
      `iotHelper - getIotEndpoint`
    );

    // Handling Promise Rejection
    process.on('unhandledRejection', error => {
      throw error;
    });

    return new Promise((resolve, reject) => {
      let iot = new AWS.Iot({
        region: process.env.AWS_REGION,
      });
      let params = {
        endpointType: 'iot:Data-ATS'
      };
      iot.describeEndpoint(params, (err, endpt) => {
        if (err) {
          Logger.error(
            Logger.levels.INFO,
            `Error occurred while attempting to retrieve the AWS IoT endpoint for region ${process.env.AWS_REGION}.`
          );
          reject(err);
        } else {
          resolve(endpt);
        }
      });
    });
  }

  /**
   * Getting IoT Analytics Channels to check IoT Analytics availability
   */
  getIotAnalyticsChannels() {
    Logger.log(
      Logger.levels.ROBUST,
      `iotHelper - getIotAnalyticsChannels`
    );

    // Handling Promise Rejection
    process.on('unhandledRejection', error => {
      throw error;
    });

    return new Promise((resolve, reject) => {
      let iotAnalytics = new AWS.IoTAnalytics({
        region: process.env.AWS_REGION,
      });
      let params = {};
      iotAnalytics.listChannels(params, (err, data) => {
        if (err) {
          Logger.error(
            Logger.levels.INFO,
            `Error occurred while attempting to retrieve the AWS IoT Analytics channels for region ${process.env.AWS_REGION}.`
          );
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Getting IoT Device Defender account audit configuration to check IoT Device Defender availablity
   */
  getAccountAuditConfiguration() {
    Logger.log(
      Logger.levels.ROBUST,
      `iotHelper - getAccountAuditConfiguration`
    );
    // Handling Promise Rejection
    process.on('unhandledRejection', error => {
      throw error;
    });

    return new Promise((resolve, reject) => {
      let iot = new AWS.Iot({
        region: process.env.AWS_REGION,
      });
      let params = {};
      iot.describeAccountAuditConfiguration(params, (err, data) => {
        if (err) {
          Logger.error(
            Logger.levels.INFO,
            `Error occurred while attempting to retrieve the AWS IoT Account Audit Configuration for region ${process.env.AWS_REGION}.`
          );
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Updating IoT Search Index
   * @param {string} action - Customer resource action [create, delete]
   */
  updateIoTSearchIndex(action) {
    Logger.log(
      Logger.levels.ROBUST,
      `iotHelper - updateIoTSearchIndex`
    );
    // Handling Promise Rejection
    process.on('unhandledRejection', error => {
      throw error;
    });

    Logger.log(
      Logger.levels.ROBUST,
      `Attempting to update IoT search index: ${action}`
    );
    return new Promise((resolve, reject) => {
      let params = {};
      if ('Create' === action) {
        params = {
          thingIndexingConfiguration: {
            thingIndexingMode: "REGISTRY_AND_SHADOW",
            thingConnectivityIndexingMode: "STATUS"
          }
        };
      } else if ('Delete' === action) {
        params = {
          thingIndexingConfiguration: {
            thingIndexingMode: "OFF",
            thingConnectivityIndexingMode: "OFF"
          }
        };
      } else {
        reject(`Unsupported action to update IoT search index: ${action}`);
      }
      let iot = new AWS.Iot({
        region: process.env.AWS_REGION,
      });
      iot.updateIndexingConfiguration(params, (err, data) => {
        if (err) {
          Logger.error(
            Logger.levels.INFO,
            `${err}`
          );
          reject(`Error to update IoT search index: ${action}`);
        } else {
          Logger.log(
            Logger.levels.INFO,
            `Success to update index configuration: ${action}:${data}`
          );
          resolve(data);
        }
      });
    });
  }

  /**
   * Updating IoT Device Defender
   * @param {string} action - Customer resource action [create, delete]
   * @param {string} snsRoleArn - SNS publish role ARN
   * @param {string} snsTargetArn - Devide Defender SNS ARN
   * @param {string} auditRoleArn - Audit control role ARN
   */
  updateIoTDeviceDefender(action, snsRoleArn, snsTargetArn, auditRoleArn) {
    Logger.log(
      Logger.levels.ROBUST,
      `iotHelper - updateIoTDeviceDefender`
    );

    // Handling Promise Rejection
    process.on('unhandledRejection', error => {
      throw error;
    });

    return new Promise((resolve, reject) => {
      let iot = new AWS.Iot({
        region: process.env.AWS_REGION,
      });
      let scheduledAuditName = 'SmartProductDeviceDefenderAudit';

      if ('Create' === action) {
        // Updates Account Audit Configuration
        let params = {
          auditCheckConfigurations: {
            REVOKED_CA_CERTIFICATE_STILL_ACTIVE_CHECK: {
              enabled: true
            },
            REVOKED_DEVICE_CERTIFICATE_STILL_ACTIVE_CHECK: {
              enabled: true
            },
            DEVICE_CERTIFICATE_SHARED_CHECK: {
              enabled: true
            },
            LOGGING_DISABLED_CHECK: {
              enabled: true
            },
            AUTHENTICATED_COGNITO_ROLE_OVERLY_PERMISSIVE_CHECK: {
              enabled: true
            },
            UNAUTHENTICATED_COGNITO_ROLE_OVERLY_PERMISSIVE_CHECK: {
              enabled: true
            },
            CONFLICTING_CLIENT_IDS_CHECK: {
              enabled: true
            },
            DEVICE_CERTIFICATE_EXPIRING_CHECK: {
              enabled: true
            },
            IOT_POLICY_OVERLY_PERMISSIVE_CHECK: {
              enabled: true
            },
            CA_CERTIFICATE_EXPIRING_CHECK: {
              enabled: true
            }
          },
          auditNotificationTargetConfigurations: {
            SNS: {
              enabled: true,
              roleArn: snsRoleArn,
              targetArn: snsTargetArn
            }
          },
          roleArn: auditRoleArn
        };

        iot.updateAccountAuditConfiguration(params, (err, _data) => {
          if (err) {
            Logger.error(
              Logger.levels.INFO,
              `${err}`
            );
            reject(`Error to update account audit configuration: ${action}`);
          } else {
            // Creates scheduled audit
            params = {
              frequency: "DAILY",
              scheduledAuditName: scheduledAuditName,
              targetCheckNames: [
                "CONFLICTING_CLIENT_IDS_CHECK",
                "DEVICE_CERTIFICATE_SHARED_CHECK",
                "AUTHENTICATED_COGNITO_ROLE_OVERLY_PERMISSIVE_CHECK",
                "DEVICE_CERTIFICATE_EXPIRING_CHECK",
                "CA_CERTIFICATE_EXPIRING_CHECK",
                "UNAUTHENTICATED_COGNITO_ROLE_OVERLY_PERMISSIVE_CHECK",
                "LOGGING_DISABLED_CHECK",
                "IOT_POLICY_OVERLY_PERMISSIVE_CHECK",
                "REVOKED_CA_CERTIFICATE_STILL_ACTIVE_CHECK",
                "REVOKED_DEVICE_CERTIFICATE_STILL_ACTIVE_CHECK"
              ]
            }

            iot.createScheduledAudit(params, (err, data) => {
              if (err) {
                Logger.error(
                  Logger.levels.INFO,
                  `${err}`
                );
                reject('Error to create scheduled audit');
              } else {
                resolve(data);
              }
            });
          }
        });
      } else if ('Delete' === action) {
        // Deletes account audit configuration & scheduled audit
        let params = {
          deleteScheduledAudits: true
        };
        iot.deleteAccountAuditConfiguration(params, function (err, data) {
          if (err) {
            Logger.error(
              Logger.levels.INFO,
              `${err}`
            );
            reject('Error to delete account audit configuration and scheduled audit');
          } else {
            resolve(data);
          }
        });
      } else {
        reject(`Unsupported action to update IoT search index: ${action}`);
      }
    });
  }

  /**
   * Creates a default thing type
   */
  async createThingType() {
    Logger.log(
      Logger.levels.ROBUST,
      `iotHelper - createThingType`
    );

    // Handling Promise Rejection
    process.on('unhandledRejection', error => {
      throw error;
    });

    let iot = new AWS.Iot({
      region: process.env.AWS_REGION,
    });

    let params = {
      thingTypeName: 'SmartProduct',
      thingTypeProperties: {
        searchableAttributes: [
          'deviceName',
          'modelNumber',
          'userId'
        ],
        thingTypeDescription: 'Smart Product default thing type',
      },
    };

    try {
      let data = await iot.createThingType(params).promise();
      return Promise.resolve(data);
    } catch (err) {
      Logger.error(
        Logger.levels.INFO,
        `${err}`
      );
      return Promise.reject('Error to create a thing type');
    }
  }
}

module.exports = iotHelper;
