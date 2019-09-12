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
 * Sends alerts for smart products events to SNS.
 *
 * @class Alert
 */
class Alert {
  /**
   * @class Alert
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
   * Sends alert for event message for smart product.
   * @param {JSON} message - message object
   */
  async sendAlert(message) {
    const _self = this;
    const _type = message.type;
    const _deviceId = message.deviceId;

    //Step1. find device registration and get ownerid
    try {
      const validRegistration = await _self._getDeviceRegistration(_deviceId);
      if (!validRegistration) {
        Logger.error(
          Logger.levels.INFO,
          `[MissingRegistration] No registration found for device ${_deviceId}.`
        );
        return Promise.reject({
          code: 400,
          error: 'MissingRegistration',
          message: `No registration found for user for device "${_deviceId}".`,
        });
      } else {
        let _userId = validRegistration.userId;

        //Step2. get phone number
        const _phoneNumberAtt = await _self._getUserRegisteredPhoneNumber(
          _userId
        );
        if (!_phoneNumberAtt) {
          Logger.error(
            Logger.levels.INFO,
            `[MissingPhoneNumber] No phone number found.`
          );
          return Promise.reject({
            code: 400,
            error: 'MissingPhoneNumber',
            message: `No phone number found.`,
          });
        }

        //Step3. get alert level and notification status from user settings
        const _settingsData = await _self._getUserAlertLevel(_userId);
        if (!_settingsData) {
          Logger.error(
            Logger.levels.INFO,
            `[MissingUserConfig] No user settings found.`
          );
          return Promise.reject({
            code: 400,
            error: 'MissingUserConfig',
            message: `No user settings found.`,
          });
        }
        const alertLevel = _settingsData.Item.setting.alertLevel;
        const sendNotification = _settingsData.Item.setting.sendNotification;
        if (!sendNotification) {
          return Promise.resolve({
            code: 200,
            message: `alert not sent for device "${message.deviceId}" event type "${message.type}".`,
          });
        }

        //Step4. publish text message
        if (alertLevel.indexOf(_type) > -1) {
          const sns = new AWS.SNS({apiVersion: '2010-03-31'});
          let params = {
            PhoneNumber: _phoneNumberAtt[0].Value,
            Message: `** Smart Product Event Alert **\nYou have a new ${message.type} event.\n\n* Device: ${validRegistration.deviceName}\n* Time: ${message.createdAt}\n* Message: ${message.message}\n* Value: ${message.details.value}`
          };
          await sns.publish(params).promise();
          return Promise.resolve({
            code: 200,
            message: `alert sent for device "${message.deviceId}".`,
          });
        } else {
          return Promise.resolve({
            code: 200,
            message: `alert not sent for device "${message.deviceId}" event type "${message.type}".`,
          });
        }
      }
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      return Promise.reject({
        code: 500,
        error: 'SendAlertFailure',
        message: `Error occurred while attempting to send event alert for device "${message.deviceId}".`,
      });
    }
  }

  async _getDeviceRegistration(deviceId) {
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
        return Promise.resolve(devices[0]);
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

  async _getUserRegisteredPhoneNumber(userId) {
    const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
    const _params = {
      UserPoolId: process.env.IDP,
      Filter: `sub = \"${userId}\"`,
      AttributesToGet: ['phone_number'],
    };

    //return phone number if found
    try {
      const data = await cognitoidentityserviceprovider
        .listUsers(_params)
        .promise();
      if (!_.isEmpty(data.Users[0].Attributes)) {
        return Promise.resolve(data.Users[0].Attributes);
      } else {
        return Promise.resolve(false);
      }
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[UsersRetrieveFailure] Error occurred while attempting to list users for user pool ${
          _params.UserPoolId
        }.`
      );
      return Promise.reject({
        code: 500,
        error: 'UsersRetrieveFailure',
        message: `Error occurred while attempting to list users from user pool.`,
      });
    }
  }

  async _getUserAlertLevel(userId) {
    const params = {
      TableName: process.env.SETTINGS_TBL,
      Key: {
        settingId: userId,
      },
    };

    const docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);

    try {
      const data = await docClient.get(params).promise();
      if (!_.isEmpty(data)) {
        return Promise.resolve(data);
      } else {
        return Promise.resolve(false);
      }
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[SettingsRetrieveFailure] Error occurred while attempting to retrieve user settings information.`
      );
      return Promise.reject({
        code: 500,
        error: 'SettingsRetrieveFailure',
        message: `Error occurred while attempting to retrieve user settings information.`,
      });
    }
  }
}

module.exports = Alert;
