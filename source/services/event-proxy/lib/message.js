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
const uuid = require('uuid');

/**
 * Performs proxy actions for messages from smart products to IoT.
 *
 * @class Message
 */
class Message {
  /**
   * @class Message
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
   * Creates a event message for smart product.
   * @param {JSON} message - message object
   */
  async createEvent(message) {
    let _event = {
      ...message,
    };
    _event.id = uuid.v4();
    _event.createdAt = moment()
      .utc()
      .format();
    _event.updatedAt = moment()
      .utc()
      .format();
    _event.ack = false;
    _event.suppress = false;

    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);

    /**
     * Gets userId from the registrations table
     * This part can be removed if devices send userId directly.
    */
    let data = await this._getUserId(_event.deviceId);
    if (data.Count === 0) {
      Logger.error(
        Logger.levels.INFO,
        `[MissingRegistration] No registration found for device ${deviceId}.`
      );
      return Promise.reject({
        code: 400,
        error: 'MissingRegistration',
        message: `No registration found for device ${deviceId}.`,
      });
    } else if (data.Count > 1) {
      Logger.error(
        Logger.levels.INFO,
        `[RegistrationRetrieveFailure] Multiple records found for device ${deviceId}.`
      );
      return Promise.reject({
        code: 400,
        error: 'RegistrationRetrieveFailure',
        message: `Multiple records found for device ${deviceId}.`,
      });
    }
    _event.userId = data.Items[0].userId;

    let params = {
      TableName: process.env.EVENTS_TBL,
      Item: _event,
    };

    // Puts the event message
    try {
      await docClient.put(params).promise();
      return Promise.resolve(_event);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      return Promise.reject({
        code: 500,
        error: 'EventCreateFailure',
        message: `Error occurred while attempting to create event message for device ${
          message.deviceId
        }.`,
      });
    }
  }

  /**
   * Gets a user ID for the device.
   * @param {string} deviceId - device ID
   */
  async _getUserId(deviceId) {
    let params = {
      TableName: process.env.REGISTRATION_TBL,
      IndexName: 'deviceId-index',
      KeyConditionExpression: 'deviceId = :deviceId',
      ExpressionAttributeValues: {
        ':deviceId': deviceId
      }
    };

    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let result = docClient.query(params).promise();
      return Promise.resolve(result);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[RegistrationRetrieveFailure] Error occurred while attempting to retrieve registration information for device ${deviceId}.`
      );
      return Promise.reject({
        code: 500,
        error: 'RegistrationRetrieveFailure',
        message: `Error occurred while attempting to retrieve registration information for device ${deviceId}.`
      });
    }
  }
}

module.exports = Message;
