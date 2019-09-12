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
const Logger = require('logger');
const Alert = require('./alert.js');

const respond = async event => {
  const _a = new Alert();
  try {
    const result = await _a.sendAlert(event);
    return Promise.resolve(result);
  } catch (err) {
    Logger.error(Logger.levels.INFO, err);
    Logger.error(
      Logger.levels.INFO,
      `Error occurred while attempting to send alert notification`
    );
    return Promise.reject(err);
  }
};

module.exports = {
  respond,
};
