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

/**
 * Lib
 */
const _ = require('underscore');
const Logger = require('logger');
const Message = require('./message.js');
const AWS = require('aws-sdk');

const response = async event => {
  let _m = new Message();
  let _message = {};

  if (typeof event === 'object') {
    _message = event;
  } else {
    _message = JSON.parse(event);
  }

  try {
    const result = await _m.createEvent(_message);
    const lambda = new AWS.Lambda({region: process.env.AWS_REGION});
    await lambda
      .invoke({
        FunctionName: process.env.NOTIFICATION_LAMBDA,
        InvocationType: 'Event',
        Payload: JSON.stringify(result),
      })
      .promise();
    return Promise.resolve(result);
  } catch (err) {
    Logger.error(Logger.levels.INFO, err);
    Logger.error(
      Logger.levels.INFO,
      `Error occurred while attempting to create event and invoke notification for device.`
    );
    return Promise.reject(err);
  }
};

module.exports = {
  response,
};
