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

/**
 * Performs status query operations for a device
 *
 * @class Status
 */
class Status {
  /**
   * @class Status
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
   * Retrieves the status information for a device.
   * @param {JSON} ticket - authentication ticket
   * @param {string} deviceId - id of device to retrieve
   */
  async getDeviceStatus(ticket, deviceId) {
    const {sub} = ticket;

    try {
      let validRegistration = await this._validateUserDeviceRegistration(
        deviceId,
        sub
      );
      if (validRegistration) {
        const iot = new AWS.Iot({
          region: process.env.AWS_REGION,
        });
        const _endP = await iot.describeEndpoint().promise();
        const iotdata = new AWS.IotData({
          endpoint: _endP.endpointAddress,
          apiVersion: '2015-05-28',
        });

        // Gets thing shadow
        const _shadow = await iotdata
          .getThingShadow({thingName: deviceId})
          .promise();
        Logger.log(
          Logger.levels.ROBUST,
          JSON.stringify(`current shadow document: ${_shadow.payload}`)
        );

        let payload = _shadow.payload;
        if (typeof _shadow.payload === 'string') {
          payload = JSON.parse(_shadow.payload);
        }

        // Gets thing connectivity status
        const queryString = `thingName:${deviceId}`;
        const params = {
          queryString: queryString,
          indexName: 'AWS_Things',
        };

        let result = await iot.searchIndex(params).promise();
        let things = result.things;

        if (things.length === 0) {
          payload['connected'] = false;
        } else {
          payload['connected'] = things[0].connectivity.connected;
        }

        _shadow.payload = payload;

        //returning sample status temporarily
        return Promise.resolve(_shadow.payload);
      } else {
        Logger.error(
          Logger.levels.INFO,
          `[MissingRegistration] No registration found for device ${deviceId}.`
        );
        return Promise.reject({
          code: 400,
          error: 'MissingRegistration',
          message: `No registration found for device "${deviceId}".`,
        });
      }
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `Error occurred while attempting to retrieve status for device ${deviceId}.`
      );

      // If the thing shadow is not created, return an empty data.
      if (err.code === 'ResourceNotFoundException') {
        return Promise.resolve({});
      }

      return Promise.reject({
        code: 500,
        error: 'StatusRetrieveFailure',
        message: `Error occurred while attempting to retrieve status for device "${deviceId}".`,
      });
    }
  }

  /**
   * Validates device is registered to user.
   * @param {string} deviceId - id of device to retrieve
   * @param {string} userId - id of the user to retrieve
   */
  async _validateUserDeviceRegistration(deviceId, userId) {
    let params = {
      TableName: process.env.REGISTRATION_TBL,
      Key: {
        userId: userId,
        deviceId: deviceId,
      },
    };

    const docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let data = await docClient.get(params).promise();
      if (!_.isEmpty(data)) {
        return Promise.resolve(true);
      } else {
        return Promise.resolve(false);
      }
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[RegistrationRetrieveFailure] Error occurred while attempting to retrieve registration information for device ${deviceId}.`
      );
      return Promise.reject({
        code: 500,
        error: 'RegistrationRetrieveFailure',
        message: `Error occurred while attempting to retrieve registration information for device "${deviceId}".`,
      });
    }
  }
}

module.exports = Status;
