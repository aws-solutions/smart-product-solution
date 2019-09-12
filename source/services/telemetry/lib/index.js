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

const has = Object.prototype.hasOwnProperty;

/**
 * Convert Fahrenheit of degree to Celsius of degree
 * @param {number} temperature
 * @returns {number}
 */
const fahrenheitToCelsius = temperature => {
  return parseFloat((((temperature - 32) * 5) / 9).toFixed(2));
};

const process = async function(event) {
  try {
    event.forEach(e => {
      // Converting temperature from Fahrenheit to Celsius
      if (has.call(e, 'actualTemperature')) {
        e.actualTemperatureC = fahrenheitToCelsius(e.actualTemperature);
      }
      if (has.call(e, 'targetTemperature')) {
        e.targetTemperatureC = fahrenheitToCelsius(e.targetTemperature);
      }

      // Adding UTC time
      if (has.call(e, 'timestamp')) {
        let utcTime = new Date(e.timestamp).toISOString();
        e.sentAtUtc = utcTime;
        e.createdAtUtc = utcTime;
      }
    });

    return Promise.resolve(event);
  } catch (err) {
    Logger.error(Logger.levels.INFO, err);
    Logger.error(
      Logger.levels.INFO,
      `Error occurred while transforming the telemetry event.`
    );
    return Promise.reject(err);
  }
};

module.exports = {
  process,
};
