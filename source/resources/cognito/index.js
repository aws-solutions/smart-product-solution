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

const AWS = require('aws-sdk');
const moment = require('moment');
const Logger = require('logger');

const creds = new AWS.EnvironmentCredentials('AWS');
const dynamoConfig = {
  credentials: creds,
  region: process.env.AWS_REGION,
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);

/**
  * Request handler.
  */
const handler = async (event) => {
  try {
    let triggerSource = event.triggerSource;
    if (triggerSource === 'PostConfirmation_ConfirmSignUp') {
      let settingId = event.request.userAttributes.sub;
      let _setting = {
        settingId: settingId,
        setting: {
          alertLevel: [
            'error',
            'warning',
          ],
          sendNotification: false
        },
        createdAt: moment().utc().format(),
        updatedAt: moment().utc().format(),
      };

      let params = {
        TableName: process.env.SETTINGS_TBL,
        Item: _setting,
      };
      await docClient.put(params).promise();

      Logger.log(
        Logger.levels.INFO,
        `Success to process the setting: ${settingId}.`
      );
    }
    return Promise.resolve(event);
  } catch (err) {
    Logger.error(
      Logger.levels.INFO,
      `Error occurred while processing the Cognito trigger: ${err}`
    );
    return Promise.reject(err);
  }
};

module.exports = {
  handler,
};