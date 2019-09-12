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
const AWS = require('aws-sdk');
const _ = require('underscore');
const moment = require('moment');

/**
 * Performs device actions for a user, such as, retrieving device information.
 *
 * @clasee Device
 */
class Device {
  /**
   * @class Device
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
   * Gets list of devices for user
   * @param {JSON} ticket - authorization ticket
   */
  async getDevices(ticket) {
    const userId = ticket.sub;
    try {
      let result = this._getDevices(userId, null);
      return Promise.resolve(result);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * Gets list of devices for user
   * @param {string} userId - a user ID
   * @param {string} nextToken - next token tot get the devices
   */
  async _getDevices(userId, nextToken) {
    let devices = [];

    try {
      const iot = new AWS.Iot({
        region: process.env.AWS_REGION,
      });
      const queryString = `attributes.userId:${userId}`;

      // Search index parameters
      const params = {
        queryString: queryString,
        indexName: 'AWS_Things',
      };

      if (nextToken) {
        params['nextToken'] = nextToken;
      }

      let result = await iot.searchIndex(params).promise();
      devices = [...result.things];

      // If there is more data, load more data and append them to devices
      if (result.nextToken !== null) {
        params['nextToken'] = result.nextToken;
        let moreResult = this._getDevices(ticket, nextToken);
        devices = [...devices, ...moreResult];
      }

      return Promise.resolve(devices);
    } catch (err) {
      if (err.message) {
        return Promise.reject(err);
      }

      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[DevicesRetrieveFailure] Error occurred while attempting to search devices.`
      );
      return Promise.reject({
        code: 500,
        error: 'DevicesRetrieveFailure',
        message: `Error occurred while attempting to search devices.`
      });
    }
  }

  /**
   * Retrieves a device.
   * @param {JSON} ticket - authorization ticket
   * @param {string} deviceId - a device ID
   */
  async getDevice(ticket, deviceId) {
    try {
      let data = await this._getDevice(ticket.sub, deviceId);
      if (!_.isEqual(data, {})) {
        return Promise.resolve(data.Item);
      } else {
        return Promise.reject({
          code: 400,
          error: 'MissingDevice',
          message: `The device "${deviceId}" does not exist.`
        });
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * Retrieves a device.
   * @param {string} userId - a user ID
   * @param {string} deviceId - a device ID
   */
  async _getDevice(userId, deviceId) {
    const params = {
      TableName: process.env.REGISTRATION_TBL,
      Key: {
        userId: userId,
        deviceId: deviceId
      }
    };

    const docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let data = await docClient.get(params).promise();
      return Promise.resolve(data);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[DeviceRetrieveFailure] Error occurred while attempting to retrieve device ${deviceId}.`
      );

      return Promise.reject({
        code: 500,
        error: 'DeviceRetrieveFailure',
        message: `Error occurred while attempting to retrieve device "${deviceId}".`,
      });
    }
  }

  /**
   * Gets IoT device
   * @param {string} userId - a user ID
   * @param {string} deviceId - a device ID
   */
  async _getIotDevice(userId, deviceId) {
    try {
      const iot = new AWS.Iot({
        region: process.env.AWS_REGION,
      });

      let params = {
        thingName: deviceId,
      };

      let result = await iot.describeThing(params).promise();
      if (result.attributes.userId !== userId) {
        return Promise.resolve({});
      } else {
        return Promise.resolve(result);
      }
    } catch(err) {
      if (err.code === 'ResourceNotFoundException') {
        return Promise.resolve({});
      } else {
        return Promise.reject(err);
      }
    }
  }

  /**
   * Deletes a device.
   * @param {JSON} ticket - authorization ticket
   * @param {string} deviceId - a device ID
   */
  async deleteDevice(ticket, deviceId) {
    let ddbEmpty = false;
    let iotEmpty = false;

    try {
      // Gets device from DDB and delete from DDB
      let data = await this._getDevice(ticket.sub, deviceId);
      if (!_.isEqual(data, {})) {
        let device = data.Item;
        device.updatedAt = moment().utc().format();
        device.status = 'deleted'

        let params = {
          TableName: process.env.REGISTRATION_TBL,
          Item: device,
        };

        const docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
        await docClient.put(params).promise();
      } else {
        ddbEmpty = true;
      }

      // Gets device from IoT and delete from IoT
      let iotData = await this._getIotDevice(ticket.sub, deviceId);
      if (!_.isEqual(iotData, {})) {
        let params = {
          thingName: deviceId,
        };

        const iot = new AWS.Iot({
          region: process.env.AWS_REGION,
        });

        // Step 1. Get thing principals
        let result = await iot.listThingPrincipals(params).promise();
        let principals = result.principals;

        for (let i = 0; i < principals.length; i++) {
          let principal = principals[i];
          if (principal.indexOf('cert/') > -1) {
            let certificateId = principal.substring(
              principal.indexOf('cert/') + 5,
              principal.length
            );
            
            // Step 2. Detach thing principals
            await iot.detachThingPrincipal({
              principal: principals[i],
              thingName: deviceId
            }).promise();

            // Step 3. Update certificate
            await iot.updateCertificate({
              certificateId: certificateId,
              newStatus: 'INACTIVE'
            }).promise();

            // Step 4. Delete certificate
            await iot.deleteCertificate({
              certificateId: certificateId,
              forceDelete: true
            }).promise();

            // Step 5. Delete policy
            await iot.deletePolicy({
              policyName: certificateId
            }).promise();
          }
        }

        // Step 6. Delete thing
        await iot.deleteThing(params).promise();
      } else {
        iotEmpty = true;
      }

      if (ddbEmpty && iotEmpty) {
        return Promise.reject({
          code: 400,
          error: 'MissingDevice',
          message: `The device "${deviceId}" does not exist.`
        });
      }

      return Promise.resolve('Delete successful');
    } catch (err) {
      if (err.error == 'MissingDevice') {
        return Promise.reject(err);
      }

      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[DeviceDeleteFailure] Error occurred while attempting to delete device ${deviceId}.`
      );

      return Promise.reject({
        code: 500,
        error: 'DeviceDeleteFailure',
        message: `Error occurred while attempting to delete device "${deviceId}".`,
      });
    }
  }
}

module.exports = Device;
