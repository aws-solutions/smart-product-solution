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

const Logger = require('logger');
const moment = require('moment');
const AWS = require('aws-sdk');
const _ = require('underscore');
const UsageMetrics = require('usage-metrics');

/**
 * Performs device registration actions, such as, creating and retrieving device registration information.
 *
 * @class registration
 */
class Registration {
  /**
   * @class Registration
   * @constructor
   */
  constructor() {
    this.creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
    this.dynamoConfig = {
      credentials: this.creds,
      region: process.env.AWS_REGION,
    };
  }

  /**
   * Gets list of registration for the user.
   * @param {JSON} ticket - authorization ticket.
   */
  async listRegistrations(ticket) {
    let userId = ticket.sub;
    try {
      let registrations = await this._getRegistrationPage(userId);
      return Promise.resolve(registrations, null);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `Error occurred while attempting to retrieve registrations.`
      );
      return Promise.reject({
        code: 500,
        error: 'RegistrationListRetrievalFailure',
        message: err.message,
      });
    }
  }

  /**
   * Get specific registrations page for the user.
   * @param {string} userId - user id from authorization ticket.
   * @param {string} lastevalkey - a serializable JavaScript object representing last evaluated key
   */
  async _getRegistrationPage(userId, lastevalkey) {
    let registrations = [];
    let _keyConditionExpression = 'userId = :uid';
    let _expressionAttributeValues = {
      ':uid': userId,
    };

    const params = {
      TableName: process.env.REGISTRATION_TBL,
      IndexName: 'userId-deviceName-index',
      KeyConditionExpression: _keyConditionExpression,
      ExpressionAttributeValues: _expressionAttributeValues,
      Limit: 100,
    };

    if (lastevalkey) {
      params.ExclusiveStartKey = lastevalkey;
    }

    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let result = await docClient.query(params).promise();
      registrations = [...result.Items];

      // If there is more data, load more data and append them to registrations
      if (result.LastEvaluatedKey) {
        let moreResult = await this._getRegistrationPage(userId, result.LastEvaluatedKey);
        registrations = [...registrations, ...moreResult];
      }

      return Promise.resolve(registrations);
    } catch (err) {
      if (err.message) {
        return Promise.reject(err);
      }

      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[RegistrationQueryFailure] Error occurred while attempting to retrieve registrations from registration table with lastEvaluatedKey ${lastevalkey}.`,
      );

      return Promise.reject({
        code: 500,
        error: 'RegistrationQueryFailure',
        message: `Error occurred while attempting to retrieve registrations.`,
      });
    }
  }

  /**
   * Creates a smart product registration for user.
   * @param {JSON} ticket - authentication ticket
   * @param {JSON} registration - device registration object
   */
  async createRegistration(ticket, registration) {
    const {deviceId, deviceName, modelNumber} = registration;
    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    let errors = [
      'DeviceNotFoundFailure',
      'DeviceRegisteredFailure',
      'RetrieveReferenceFailure',
      'RetrieveRegistrationFailure',
      'CreateThingFailure',
      'DeviceRollBackFailure'
    ];

    try {
      // 1. Checks if the device ID and model number is valid.
      let reference = await this._getReference(deviceId, modelNumber);
      if (_.isEqual(reference, {})) {
        return Promise.reject({
          code: 400,
          error: 'DeviceNotFoundFailure',
          message: `Manufacturer info cannot be found for serial number "${deviceId}" and model number "${
            modelNumber}". Please add a model number/serial number that is supported by the manufacturer.`
        });
      }
      let {details} = reference.Item;

      // 2. Checks if the device is already registered.
      let isDeviceRegistered = await this._isDeviceRegistered(deviceId);
      if (isDeviceRegistered) {
        return Promise.reject({
          code: 500,
          error: 'DeviceRegisteredFailure',
          message: `Device with serial number "${deviceId}" has been already registered.`
        });
      }

      // 3. Puts an item into the DynamoDB table
      let _registration = {
        deviceId,
        deviceName,
        modelNumber,
        details,
        status: 'pending',
        userId: ticket.sub,
        createdAt: moment()
          .utc()
          .format(),
        updatedAt: moment()
          .utc()
          .format(),
      };

      let params = {
        TableName: process.env.REGISTRATION_TBL,
        Item: _registration,
      };

      await docClient.put(params).promise();

      // 4. Creates a thing
      try {
        await this._createThing(_registration);
      } catch (err) {
        // If error occurs while creating a thing, rollback DynamoDB.
        let params = {
          TableName: process.env.REGISTRATION_TBL,
          Key: {
            userId: ticket.sub,
            deviceId: deviceId,
          }
        };

        try {
          await docClient.delete(params).promise();
        } catch (err) {
          Logger.error(Logger.levels.INFO, err);
          Logger.error(
            Logger.levels.INFO,
            `[DeviceRollBackFailure] Error occurred while rolling back the device ${deviceId} registration.`
          );

          return Promise.reject({
            code: 500,
            error: 'DeviceRollBackFailure',
            message: `Error occurred while rolling back the device "${deviceId}" registration.`
          });
        }

        return Promise.reject(err);
      }

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

      return Promise.resolve(_registration);
    } catch (err) {
      // Handling existing errors
      if (errors.indexOf(err.error) > -1) {
        return Promise.reject(err);
      }

      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[RegistrationCreateFailure] Error occurred while attempting to create registration for device ${deviceId}.`
      );
      return Promise.reject({
        code: 500,
        error: 'RegistrationCreateFailure',
        message: `Error occurred while attempting to create registration for device "${deviceId}".`,
      });
    }
  }

  /**
   * Gets device reference.
   * @param {string} deviceId - a device ID
   * @param {string} modelNumber - a model number
   */
  async _getReference(deviceId, modelNumber) {
    const params = {
      TableName: process.env.REFERENCE_TBL,
      Key: {
        deviceId: deviceId,
        modelNumber: modelNumber,
      },
    };

    const docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let data = await docClient.get(params).promise();
      return Promise.resolve(data);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[RetrieveReferenceFailure] Error occurred while retrieving device: deviceId ${deviceId}, modelNumber ${modelNumber}.`
      );

      return Promise.reject({
        code: 500,
        error: 'RetrieveReferenceFailure',
        message: `Error occurred while retrieving device: deviceId "${deviceId}", modelNumber "${modelNumber}".`
      });
    }
  }

  /**
   * Gets device registration.
   * @param {string} deviceId - a device ID
   */
  async _isDeviceRegistered(deviceId) {
    let _keyConditionExpression = 'deviceId = :did';
    let _expressionAttributeValues = {
      ':did': deviceId,
    };

    const params = {
      TableName: process.env.REGISTRATION_TBL,
      IndexName: 'deviceId-index',
      KeyConditionExpression: _keyConditionExpression,
      ExpressionAttributeValues: _expressionAttributeValues,
    };

    const docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let data = await docClient.query(params).promise();
      if (data.Items.length === 0) {
        return Promise.resolve(false);
      }

      let devices = data.Items.filter(device => device.status !== 'deleted');
      if (devices.length > 0) {
        return Promise.resolve(true);
      } else {
        return Promise.resolve(false);
      }
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[RetrieveRegistrationFailure] Error occurred while retrieving device ${deviceId}.`
      );

      return Promise.reject({
        code: 500,
        error: 'RetrieveRegistrationFailure',
        message: `Error occurred while retrieving device "${deviceId}".`
      });
    }
  }

  /**
   * Creates IoT thing.
   * @param {JSON} registration - device registration object
   */
  async _createThing(registration) {
    try {
      const iot = new AWS.Iot({
        region: process.env.AWS_REGION,
      });

      const _payload = {
        userId: registration.userId /* required */,
        deviceName: registration.deviceName /* required */,
        modelNumber: registration.modelNumber /* required */,
      };

      const params = {
        thingName: registration.deviceId,
        attributePayload: {
          attributes: _payload,
          merge: true,
        },
        thingTypeName: process.env.THING_TYPE,
      };

      await iot.createThing(params).promise();
      return Promise.resolve(_payload);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[CreateThingFailure] Error occurred while attempting to create thing for device "${registration.deviceId}".`
      );
      return Promise.reject({
        code: 500,
        error: 'CreateThingFailure',
        message: `Error occurred while attempting to create thing for device "${registration.deviceId}".`,
      });
    }
  }
}

module.exports = Registration;
