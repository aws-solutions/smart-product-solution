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
   * Updates command status for device
   * @param {JSON} message - message object
   */
  async statusUpdate(message) {
    // const _self = this;
    let _event = {
      ...message,
    };
    _event.updatedAt = moment()
      .utc()
      .format();

    const params = {
      TableName: process.env.COMMANDS_TBL,
      Key: {
        deviceId: message.deviceId,
        commandId: message.commandId,
      },
      ExpressionAttributeNames: {
        '#S': 'status',
        '#U': 'updatedAt',
        '#R': 'reason',
      },
      ExpressionAttributeValues: {
        ':s': message.status,
        ':u': moment()
          .utc()
          .format(),
        ':r': message.reason,
      },
      UpdateExpression: 'SET #S = :s, #U = :u, #R = :r',
    };

    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    let ddbPromise = docClient.update(params).promise();

    try {
      await ddbPromise;
      return Promise.resolve(_event);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      return Promise.reject({
        code: 500,
        error: 'StatusUpdateFailure',
        message: `Error occurred while updating command status for device ${
          message.deviceId
        } command ${message.commandId}.`,
      });
    }
  }
}

module.exports = Message;
