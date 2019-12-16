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
const uuidv4 = require('uuid/v4');
const UsageMetrics = require('usage-metrics');
const CommonUtils = require('utils');

/**
 * Performs command actions for a user, such as, retrieving and logging device command information.
 *
 * @class Command
 */
class Command {
  /**
   * @class Command
   * @constructor
   */
  constructor() {
    this.creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
    this.dynamoConfig = {
      credentials: this.creds,
      region: process.env.AWS_REGION,
    };
    this.commonUtils = new CommonUtils();
  }

  /**
   * Gets list of commands for the device.
   * @param {JSON} ticket - authorization ticket.
   * @param {string} deviceId - unique identifier for the device
   * @param {string} lastevalkey - a serializable JavaScript object representing last evaluated key
   * @param {string} commandStatus - command status to filter
   */
  async getCommands(ticket, lastevalkey, deviceId, commandStatus) {
    try {
      let validRegistration = await this._validateUserDeviceRegistration(
        deviceId,
        ticket.sub
      );

      if (validRegistration) {
        let commands = await this._getCommandsPage(deviceId, lastevalkey, commandStatus, 0);
        return Promise.resolve(commands);
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
      return Promise.reject(err);
    }
  }

  /**
   * Get specific commands page for the device.
   * @param {string} deviceId - unique identifier for the device
   * @param {string} lastevalkey - a serializable JavaScript object representing last evaluated key
   * @param {string} commandStatus - command status to filter
   * @param {number} length - a length of commands
   */
  async _getCommandsPage(deviceId, lastevalkey, commandStatus, length) {
    let _keyConditionExpression = 'deviceId = :did';
    let _expressionAttributeValues = {
      ':did': deviceId,
    };
    let _expressionAttributeNames = '';

    /**
     * DynamoDB FilterExpression
     * If there are query parameters, add the value to the filter expression.
     */
    let _filterExpression = '';

    // Filters with command status
    if (commandStatus !== undefined
      && commandStatus.trim() !== '') {
      _filterExpression = '#status = :commandStatus';
      _expressionAttributeValues[':commandStatus'] = commandStatus.trim();
      // params.ExpressionAttributeNames = {
      _expressionAttributeNames = {
        '#status': 'status'
      };
    }

    let params = this.commonUtils.generateDynamoDBQueryParams(
      process.env.COMMANDS_TBL,
      _keyConditionExpression,
      _expressionAttributeValues,
      _expressionAttributeNames,
      _filterExpression,
      'deviceId-updatedAt-index',
      false,
      lastevalkey
    );

    let commands = [];
    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let result = await docClient.query(params).promise();
      commands = result.Items;
      length += commands.length;

      // In case the result is less than 20 in total due to FilterExpression, call the method again with LastEvaluatedKey.
      if (length < 20
        && result.LastEvaluatedKey) {
        lastevalkey = result.LastEvaluatedKey;
        try {
          let data = await this._getCommandsPage(deviceId, lastevalkey, commandStatus, length);
          commands = [...commands, ...data.Items];
        result.LastEvaluatedKey = data.LastEvaluatedKey;
        } catch (err) {
          return Promise.reject(err);
        }
      }

      result.Items = commands;
      result.commandStatus = commandStatus;
      return Promise.resolve(result);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      return Promise.reject({
        code: 500,
        error: 'CommandQueryFailure',
        message: `Error occurred while attempting to retrieve commands for device "${deviceId}".`,
      });
    }
  }

  /**
   * Retrieves a command for a device.
   * @param {JSON} ticket - authentication ticket
   * @param {string} deviceId - id of device to retrieve
   * @param {string} commandId - id of the command to retrieve
   */
  async getCommand(ticket, deviceId, commandId) {
    const params = {
      TableName: process.env.COMMANDS_TBL,
      Key: {
        deviceId: deviceId,
        commandId: commandId,
      },
    };

    const docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let validRegistration = await this._validateUserDeviceRegistration(
        deviceId,
        ticket.sub
      );

      if (validRegistration) {
        let data = await docClient.get(params).promise();
        if (!_.isEmpty(data)) {
          return Promise.resolve(data.Item);
        } else {
          return Promise.reject({
            code: 400,
            error: 'MissingCommand',
            message: `The command "${commandId}" for device "${deviceId}" does not exist.`,
          });
        }
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
        `Error occurred while attempting to retrieve command ${commandId} for device ${deviceId}.`
      );
      return Promise.reject({
        code: 500,
        error: 'CommandRetrieveFailure',
        message: `Error occurred while attempting to retrieve command "${commandId}" for device "${deviceId}".`,
      });
    }
  }

  /**
   * Creates a device command for user.
   * @param {JSON} ticket - authentication ticket
   * @param {string} deviceId - id of device to retrieve
   * @param {JSON} command - device command object
   */
  async createCommand(ticket, deviceId, command) {
    const commandModes = ['set-temp', 'set-mode'];
    const powerStatuses = ['HEAT', 'AC', 'OFF'];

    /**
     * The solution is for HVAC devices, and this will suppose the command JSON would contain below keys and values.
     * command {
     *   commandDetails: {
     *     command: "set-temp" | "set-mode",
     *     value: number | "HEAT" | "AC" | "OFF"
     *   },
     *   shadowDetails: {
     *     powerStatus: "HEAT" | "AC" | "OFF",
     *     actualTemperature: number,
     *     targetTemperature: number
     *   }
     * }
     * command.commandDetails are for DynamoDB item, and command.shadowDetails are for sending data to device.
     */
    let isCommandValid = true;
    if (command.commandDetails === undefined
      || command.shadowDetails === undefined
      || commandModes.indexOf(command.commandDetails.command) < 0
      || powerStatuses.indexOf(command.shadowDetails.powerStatus) < 0
      || isNaN(command.shadowDetails.targetTemperature)
      || command.shadowDetails.targetTemperature < 50
      || command.shadowDetails.targetTemperature > 110) {
      isCommandValid = false
    } else {
      if (command.commandDetails.command === 'set-temp') {
        if (isNaN(command.commandDetails.value)) {
          isCommandValid = false;
        } else {
          // Fix temperature precision, only keeps 2 precisions
          let targetTemperature = parseFloat(command.shadowDetails.targetTemperature).toFixed(2);
          if (parseInt(targetTemperature.slice(targetTemperature.indexOf('.') + 1)) === 0) {
            targetTemperature = parseFloat(command.shadowDetails.targetTemperature).toFixed(0);
          }
          command.shadowDetails.targetTemperature = targetTemperature;
          command.commandDetails.value = targetTemperature;
        }
      }
    }

    if (!isCommandValid) {
      return Promise.reject({
        code: 400,
        error: 'InvalidParameter',
        message: 'Body parameters are invalid. Please check the API specification.'
      });
    }

    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let validRegistration = await this._validateUserDeviceRegistration(
        deviceId,
        ticket.sub
      );
      if (validRegistration) {
        let _command = {
          commandId: uuidv4(),
          deviceId: deviceId,
          status: 'pending',
          details: {
            command: command.commandDetails.command,
            value: command.commandDetails.value
          },
          userId: ticket.sub,
          createdAt: moment().utc().format(),
          updatedAt: moment().utc().format(),
        };

        let params = {
          TableName: process.env.COMMANDS_TBL,
          Item: _command,
        };

        await docClient.put(params).promise();

        let shadowDetails = {
          powerStatus: command.shadowDetails.powerStatus,
          actualTemperature: command.shadowDetails.actualTemperature,
          targetTemperature: command.shadowDetails.targetTemperature
        }
        await this.shadowUpdate(_command, shadowDetails); //best practise to update device shadow
        await this.publishCommand(_command, shadowDetails); //publish on IoT topic for the device

        // Sends anonymous metric data
        const anonymousData = process.env.anonymousData;
        const solutionId = process.env.solutionId;
        const solutionUuid = process.env.solutionUuid;

        if (anonymousData === 'true') {
          let metric = {
            Solution: solutionId,
            UUID: solutionUuid,
            Timestamp: moment().utc().format('YYYY-MM-DD HH:mm:ss.S'),
            RemoteCommands: 1,
          };

          let usageMetrics = new UsageMetrics();
          try {
            await usageMetrics.sendAnonymousMetric(metric);
          } catch (e) {
            Logger.error(Logger.levels.INFO, e);
          }
        }

        return Promise.resolve(_command);
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
        `[CommandCreateFailure] Error occurred while attempting to create command for device ${deviceId}.`
      );
      return Promise.reject({
        code: 500,
        error: 'CommandCreateFailure',
        message: `Error occurred while attempting to create command for device "${deviceId}".`,
      });
    }
  }

  /**
   * Updates device shadow with desired state
   * @param {JSON} command - device command object
   * @param {JSON} shadowDetails - shadow detail object
   */
  async shadowUpdate(command, shadowDetails) {
    try {
      const _deviceId = command.deviceId;
      const iot = new AWS.Iot({
        region: process.env.AWS_REGION,
      });
      const _endP = await iot.describeEndpoint().promise();

      // Step 1. getShadow version number
      const iotdata = new AWS.IotData({
        endpoint: _endP.endpointAddress,
        apiVersion: '2015-05-28',
      });
      const _shadow = await iotdata
        .getThingShadow({thingName: _deviceId})
        .promise();
      Logger.log(
        Logger.levels.ROBUST,
        JSON.stringify(`current shadow document: ${_shadow.payload}`)
      );

      //Step 2. update shadow with desired state from command
      const _payload = {
        state: {
          desired: shadowDetails,
        },
      };

      const result = await iotdata
        .updateThingShadow({
          thingName: _deviceId,
          payload: JSON.stringify(_payload),
        })
        .promise();
      Logger.log(
        Logger.levels.ROBUST,
        JSON.stringify(`shadow update response: ${result}`)
      );

      return Promise.resolve(result);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[DeviceShadowUpdateFailure] Error occurred while attempting to update device shadow for command ${
          command.deviceId
        }.`
      );
      return Promise.reject({
        code: 500,
        error: 'DeviceShadowUpdateFailure',
        message: `Error occurred while attempting to update device shadow for command "${command.deviceId}".`,
      });
    }
  }

  /**
   * Publishes command on IoT topic
   * @param {JSON} command - device command object
   * @param {JSON} shadowDetails - shadow detail object
   */
  async publishCommand(command, shadowDetails) {
    try {
      const iot = new AWS.Iot({
        region: process.env.AWS_REGION,
      });
      const _endP = await iot.describeEndpoint().promise();

      const iotdata = new AWS.IotData({
        endpoint: _endP.endpointAddress,
        apiVersion: '2015-05-28',
      });

      let _command = {
        commandId: command.commandId,
        deviceId: command.deviceId,
        status: command.status,
        details: shadowDetails,
      };

      const _result = await iotdata
        .publish({
          topic: `smartproduct/commands/${command.deviceId}`,
          payload: JSON.stringify(_command),
        })
        .promise();
      Logger.log(
        Logger.levels.ROBUST,
        JSON.stringify(`command publish response: ${_result}`)
      );

      return Promise.resolve(_result);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[CommandPublishFailure] Error occurred while attempting to publish command ${command.commandId}.`
      );
      return Promise.reject({
        code: 500,
        error: 'CommandPublishFailure',
        message: `Error occurred while attempting to publish command "${command.commandId}".`,
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

module.exports = Command;
