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

'use strict'

const Logger = require('logger');
const moment = require('moment');
const AWS = require('aws-sdk');
const _ = require('underscore');

/**
 * Performs admin actions for a user such as inviting, getting and setting configuration
 *
 * @class Admin
 */
class Admin {
  /**
   * @class Admin
   * @constructor
   */
  constructor() {
    this.creds = new AWS.EnvironmentCredentials('AWS');
    this.dynamoConfig = {
      credentials: this.creds,
      region: process.env.AWS_REGION,
    };
  }

  /**
   * Retrieves configuration settings.
   * @param {string} settingId - Configuration setting ID.
   */
  async getSettings(settingId) {
    try {
      let setting = await this._getSetting(settingId);
      if (!_.isEqual(setting, {})) {
        return Promise.resolve(setting.Item);
      } else {
        return Promise.reject({
          code: 400,
          error: 'MissingSetting',
          message: `The setting ${settingId} does not exist.`
        });
      }
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      return Promise.reject(err);
    }
  }

/**
 * Updates the configuration settings.
 * @param {string} settingId - Configuration setting ID.
 * @param {JSON} setting - Updated configuration settings object.
 */
  async updateSetting(settingId, setting) {
    try {
      
      if (setting === undefined || _.isEqual(setting, {})) {
        return Promise.reject({
          code: 400,
          error: 'InvalidSetting',
          message: `The requested setting is invalid: ${JSON.stringify(setting)}`
        });
      }

      let existingSetting = await this._getSetting(settingId);
      if (!_.isEqual(existingSetting, {})) {
        existingSetting.Item.setting = setting;
        existingSetting.Item.updatedAt = moment.utc().format();

        let updatedParams = {
          TableName: process.env.SETTINGS_TBL,
          Item: existingSetting.Item,
        };

        const docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
        let ddbPromise = await docClient.put(updatedParams).promise();
        return Promise.resolve(ddbPromise);
      } else {
        return Promise.reject({
          code: 400,
          error: 'MissingSetting',
          message: `The requested setting ${settingId} does not exist.`
        });
      }
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);

      // Handling DynamoDB get error
      if (err.error === 'SettingRetrievalFailure') {
        return Promise.reject(err);
      }

      // Handling others
      return Promise.reject({
        code: 500,
        error: 'SettingUpdateFailure',
        message: `Error occurred while attempting to update setting ${setting.settingId}.`
      });
    }
  }

  /**
   * Retrieves the setting
   * @param {string} settingId
   */
  async _getSetting(settingId) {
    const params = {
      TableName: process.env.SETTINGS_TBL,
      Key: {
        settingId: settingId,
      },
    };

    const docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let setting = await docClient.get(params).promise();
      return Promise.resolve(setting);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      return Promise.reject({
        code: 500,
        error: 'SettingRetrievalFailure',
        message: `Error occurred while attempting to retrieve the setting ${settingId}.`
      });
    }
  }
}

module.exports = Admin;