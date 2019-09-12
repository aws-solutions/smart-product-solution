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
const CommonUtils = require('utils');

/**
 * Performs event actions for a user, such as, retrieving and logging device event information.
 *
 * @class Event
 */
class Event {
  /**
   * @class Event
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
   * Gets list of events for the device.
   * @param {JSON} ticket - authorization ticket
   * @param {string} lastevalkey - a serializable JavaScript object representing last evaluated key
   * @param {string} deviceId - a device ID to filter
   * @param {string} eventType - a event type to filter
   */
  async getEvents(ticket, lastevalkey, deviceId, eventType) {
    try {
      let validRegistration = await this._validateUserDeviceRegistration(
        deviceId,
        ticket.sub
      );
      if (validRegistration) {
        let events = await this._getEventsPage(deviceId, lastevalkey, eventType, 0);
        return Promise.resolve(events);
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
   * Gets specific events page for the device.
   * @param {string} deviceId - a device ID to filter
   * @param {string} lastevalkey - a serializable JavaScript object representing last evaluated key
   * @param {string} eventType - a event type to filter
   * @param {number} length - a length of events
   */
  async _getEventsPage(deviceId, lastevalkey, eventType, length) {
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

    // Filters with event type
    if (eventType !== undefined
      && eventType.trim() !== '') {
      _filterExpression = '#type = :eventType';
      _expressionAttributeValues[':eventType'] = eventType.trim();
      _expressionAttributeNames = {
        '#type': 'type'
      };
    }

    let params = this.commonUtils.generateDynamoDBQueryParams(
      process.env.EVENTS_TBL,
      _keyConditionExpression,
      _expressionAttributeValues,
      _expressionAttributeNames,
      _filterExpression,
      'deviceId-timestamp-index',
      false,
      lastevalkey
    );

    let events = [];
    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let result = await docClient.query(params).promise();
      events = result.Items;
      length += events.length;

      // In case the result is less than 20 in total due to FilterExpression, call the method again with LastEvaluatedKey.
      if (length < 20
        && result.LastEvaluatedKey) {
        lastevalkey = result.LastEvaluatedKey;
        try {
          let data = await this._getEventsPage(deviceId, lastevalkey, eventType, length);
          events = [...events, ...data.Items];
          result.LastEvaluatedKey = data.LastEvaluatedKey;
        } catch (err) {
          return Promise.reject(err);
        }
      }

      result.Items = events;
      result.eventType = eventType;

      return Promise.resolve(result);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      return Promise.reject({
        code: 500,
        error: 'EventQueryFailure',
        message: `Error occurred while attempting to retrieve events for device "${deviceId}".`
      });
    }
  }

  /**
   * Retrieves a event for a device.
   * @param {JSON} ticket - authorization ticket
   * @param {string} deviceId - id of device to retrieve
   * @param {string} eventId - id of the event to retrieve
   */
  async getEvent(ticket, deviceId, eventId) {
    const params = {
      TableName: process.env.EVENTS_TBL,
      Key: {
        deviceId: deviceId,
        id: eventId,
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
            error: 'MissingEvent',
            message: `The event "${eventId}" for device "${deviceId}" does not exist.`,
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
        `Error occurred while attempting to retrieve event ${eventId} for device ${deviceId}.`
      );
      return Promise.reject({
        code: 500,
        error: 'EventRetrieveFailure',
        message: `Error occurred while attempting to retrieve event "${eventId}" for device "${deviceId}".`,
      });
    }
  }

  /**
   * Updates a device event [acknowledge and suppress] for user.
   * @param {JSON} ticket - authorization ticket
   * @param {JSON} event - device event to update
   */
  async updateEvent(ticket, deviceId, updatedEvent) {
    const has = Object.prototype.hasOwnProperty;

    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let validRegistration = await this._validateUserDeviceRegistration(
        deviceId,
        ticket.sub
      );
      if (validRegistration) {
        let oldEvent = await this.getEvent(ticket, deviceId, updatedEvent.id);
        oldEvent.updatedAt = moment()
          .utc()
          .format();
        oldEvent.ack = has.call(updatedEvent, 'ack')
          ? updatedEvent.ack
          : false;
        oldEvent.suppress = has.call(updatedEvent, 'suppress')
          ? updatedEvent.suppress
          : false;

        let _updateParams = {
          TableName: process.env.EVENTS_TBL,
          Item: oldEvent,
        };

        let ddbPromise = await docClient.put(_updateParams).promise();
        return Promise.resolve(ddbPromise);
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
      return Promise.reject({
        code: 500,
        error: 'EventUpdateFailure',
        message: `The event "${updatedEvent.id}" for device "${deviceId}" failed to update.`,
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

  /**
   * Gets list of event history for the user.
   * @param {JSON} ticket - authorization ticket
   * @param {string} lastevalkey - a serializable JavaScript object representing last evaluated key
   * @param {string} deviceId - a device ID to filter
   * @param {string} eventType - a event type to filter
   */
  async getEventHistory(ticket, lastevalkey, deviceId, eventType) {
    let userId = ticket.sub;

    try {
      let events = await this._getEventHistoryPage(userId, lastevalkey, deviceId, eventType, 0);
      return Promise.resolve(events);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * Gets specific event history page for the user.
   * @param {string} userId - unique identifier for the user
   * @param {string} lastevalkey - a serializable JavaScript object representing last evaluated key
   * @param {string} deviceId - a device ID to filter
   * @param {string} eventType - a event type to filter
   * @param {number} length - a length of events
   * @param {boolean} recursive - a boolean to check resursion
   */
  async _getEventHistoryPage(userId, lastevalkey, deviceId, eventType, length, recursive) {
    // Gets whole events
    let _keyConditionExpression = 'userId = :uid';
    let _expressionAttributeValues = {
      ':uid': userId,
    };
    let _expressionAttributeNames = '';

    /**
     * DynamoDB FilterExpression
     * If there are query parameters, add the value to the filter expression.
     */
    let _filterExpression = '';

    // Filters with device ID
    if (deviceId !== undefined
      && deviceId.trim() !== '') {
      _filterExpression = 'deviceId = :deviceId';
      _expressionAttributeValues[':deviceId'] = deviceId.trim();
    }

    // Filters with event type
    if (eventType !== undefined
      && eventType.trim() !== '') {
      if (_filterExpression === '') {
        _filterExpression = '#type = :eventType';
      } else {
        _filterExpression = `${_filterExpression} and #type = :eventType`;
      }
      _expressionAttributeValues[':eventType'] = eventType.trim();
      _expressionAttributeNames = {
        '#type': 'type'
      };
    }

    let params = this.commonUtils.generateDynamoDBQueryParams(
      process.env.EVENTS_TBL,
      _keyConditionExpression,
      _expressionAttributeValues,
      _expressionAttributeNames,
      _filterExpression,
      'userId-timestamp-index',
      false,
      lastevalkey
    );

    let events = [];
    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let result = await docClient.query(params).promise();
      events = result.Items;
      length += events.length;

      // In case the result is less than 20 in total due to FilterExpression, call the method again with LastEvaluatedKey.
      if (length < 20
        && result.LastEvaluatedKey) {
        lastevalkey = result.LastEvaluatedKey;
        try {
          let data = await this._getEventHistoryPage(userId, lastevalkey, deviceId, eventType, length, true);
          events = [...events, ...data.Items];
          result.LastEvaluatedKey = data.LastEvaluatedKey;
        } catch (err) {
          return Promise.reject(err);
        }
      }

      // If recursive is false, add device name to the result.
      if (!recursive) {
        events = await this._putDeviceName(userId, events);
      }

      result.Items = events;
      result.deviceId = deviceId;
      result.eventType = eventType;

      return Promise.resolve(result);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      return Promise.reject({
        code: 500,
        error: 'EventHistoryQueryFailure',
        message: 'Error occurred while attempting to retrieve event history.',
      });
    }
  }

  /**
   * Gets list of alerts for the user.
   * @param {JSON} ticket - authorization ticket
   * @param {string} lastevalkey - a serializable JavaScript object representing last evaluated key
   * @param {string} deviceId - a device ID to filter
   */
  async getAlerts(ticket, lastevalkey, deviceId) {
    let userId = ticket.sub;

    try {
      let alertLevel = await this._getUserAlertLevel(userId);
      if (!alertLevel && !_.isEqual(alertLevel, undefined)) {
        Logger.error(
          Logger.levels.INFO,
          `[MissingUserConfig] No user settings found.`
        );
        return Promise.reject({
          code: 400,
          error: 'MissingUserConfig',
          message: `No user settings found.`
        });
      }

      let alerts = await this._getAlertsPage(userId, alertLevel, lastevalkey, deviceId, 0);
      return Promise.resolve(alerts);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * Gets specific alert page for the device.
   * @param {string} userId - unique identifier for the user
   * @param {Array<string>} alertLevel - alert level to retrieve
   * @param {string} lastevalkey - a serializable JavaScript object representing last evaluated key
   * @param {string} deviceId - a device ID to filter
   * @param {number} length - a length of events
   * @param {boolean} recursive - a boolean to check resursion
   */
  async _getAlertsPage(userId, alertLevel, lastevalkey, deviceId, length, recursive) {
    // Gets whole alerts
    let _keyConditionExpression = 'userId = :uid';
    let _expressionAttributeValues = {
      ':uid': userId,
      ':false': false,
    };
    let _expressionAttributeNames = {
      '#ack': 'ack',
      '#type': 'type',
    };
    let _filterExpression = '#ack = :false';

    // FilterExpression for alert level
    // If user choose nothing for the alert level, return empty result.
    if (alertLevel.length > 0) {
      let _filterAlert = '';
      for (let i = 0; i < alertLevel.length; i++) {
        let alert = alertLevel[i];
        _expressionAttributeValues[`:${alert}`] = alert;

        if (i === 0) {
          _filterAlert = `#type = :${alert}`;
        } else {
          _filterAlert = `${_filterAlert} or #type = :${alert}`
        }
      }
      _filterExpression = `${_filterExpression} and (${_filterAlert})`;
    } else {
      return Promise.resolve({
        Items: [],
        deviceId: deviceId,
      })
    }

    // FilterExpression for the device ID
    if (deviceId !== undefined
      && deviceId.trim() !== '') {
      _filterExpression = `${_filterExpression} and deviceId = :deviceId`
      _expressionAttributeValues[':deviceId'] = deviceId.trim();
    }

    let params = this.commonUtils.generateDynamoDBQueryParams(
      process.env.EVENTS_TBL,
      _keyConditionExpression,
      _expressionAttributeValues,
      _expressionAttributeNames,
      _filterExpression,
      'userId-timestamp-index',
      false,
      lastevalkey
    );

    let alerts = [];
    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let result = await docClient.query(params).promise();
      alerts = result.Items;
      length += alerts.length;

      // In case the result is less than 20 in total due to FilterExpression, call the method again with LastEvaluatedKey.
      if (length < 20
        && result.LastEvaluatedKey) {
        lastevalkey = result.LastEvaluatedKey;
        try {
          let data = await this._getAlertsPage(userId, alertLevel, lastevalkey, deviceId, length, true);
          alerts = [...alerts, ...data.Items];
          result.LastEvaluatedKey = data.LastEvaluatedKey;
        } catch (err) {
          return Promise.reject(err);
        }
      }

      // If recursive is false, add device name to the result.
      if (!recursive) {
        alerts = await this._putDeviceName(userId, alerts);
      }

      result.Items = alerts;
      result.deviceId = deviceId;

      return Promise.resolve(result);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `Error occurred while attempting to retrieve event alerts.`
      );
      return Promise.reject({
        code: 500,
        error: 'AlertQueryFailure',
        message: `Error occurred while attempting to retrieve event alerts.`,
      });
    }
  }

  /**
   * Gets the count of alerts for the user.
   * @param {JSON} ticket - authorization ticket
   */
  async getAlertsCount(ticket) {
    let userId = ticket.sub;

    try {
      let alertLevel = await this._getUserAlertLevel(userId);
      if (!alertLevel && !_.isEqual(alertLevel, undefined)) {
        Logger.error(
          Logger.levels.INFO,
          `[MissingUserConfig] No user settings found.`
        );
        return Promise.reject({
          code: 400,
          error: 'MissingUserConfig',
          message: `No user settings found.`
        });
      }

      let alertsCount = await this._getAlertsCount(userId, alertLevel);
      return Promise.resolve({
        alertsCount: alertsCount
      });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * Gets the count of alerts for the user.
   * @param {string} userId - unique identifier for the user
   * @param {Array<string>} alertLevel - alert level to retrieve
   * @param {JSON} lastevalkey - a serializable JavaScript object representing last evaluated key
   */
  async _getAlertsCount(userId, alertLevel, lastevalkey) {
    // Gets whole alerts
    let _keyConditionExpression = 'userId = :uid';
    let _expressionAttributeValues = {
      ':uid': userId,
      ':false': false,
    };
    let _expressionAttributeNames = {
      '#ack': 'ack',
      '#type': 'type',
    };
    let _filterExpression = '#ack = :false';

    // FilterExpression for alert level
    // If user chooses nothing for the alert level, return 0.
    if (alertLevel.length > 0) {
      let _filterAlert = '';
      for (let i = 0; i < alertLevel.length; i++) {
        let alert = alertLevel[i];
        _expressionAttributeValues[`:${alert}`] = alert;

        if (i === 0) {
          _filterAlert = `#type = :${alert}`;
        } else {
          _filterAlert = `${_filterAlert} or #type = :${alert}`
        }
      }
      _filterExpression = `${_filterExpression} and (${_filterAlert})`;
    } else {
      return Promise.resolve(0);
    }

    let params = this.commonUtils.generateDynamoDBQueryParams(
      process.env.EVENTS_TBL,
      _keyConditionExpression,
      _expressionAttributeValues,
      _expressionAttributeNames,
      _filterExpression,
      'userId-timestamp-index',
      false,
      lastevalkey,
      'id',
      100
    );

    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let result = await docClient.query(params).promise();
      let count = result.Count;

      if (result.LastEvaluatedKey) {
        count += await this._getAlertsCount(userId, alertLevel, result.LastEvaluatedKey);
      }

      return Promise.resolve(count);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `Error occurred while attempting to get the count of event alerts.`
      );

      return Promise.reject({
        code: 500,
        error: 'AlertRetrieveFailure',
        message: `Error occurred while attempting to get the count of event alerts.`,
      });
    }
  }

  /**
   * Gets alert level for the user
   * @param {string} userId - unique identifier for the user
   */
  async _getUserAlertLevel(userId) {
    let params = {
      TableName: process.env.SETTINGS_TBL,
      Key: {
        settingId: userId,
      }
    };

    const docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);

    try {
      let data = await docClient.get(params).promise();
      if (!_.isEqual(data, {})) {
        return Promise.resolve(data.Item.setting.alertLevel);
      } else {
        return Promise.resolve(false);
      }
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[SettingsRetrieveFailure] Error occurred while attempting to retrieve settings information.`
      );
      return Promise.reject({
        code: 500,
        error: 'SettingsRetrieveFailure',
        message: `Error occurred while attempting to retrieve settings information.`
      });
    }
  }

  /**
   * Gets devices for the user
   * @param {string} userId - unique identifier for the user
   */
  async _getUserDevices(userId) {
    let _keyConditionExpression = 'userId = :uid';
    let _expressionAttributeValues = {
      ':uid': userId
    };
    let params = {
      TableName: process.env.REGISTRATION_TBL,
      KeyConditionExpression: _keyConditionExpression,
      ExpressionAttributeValues: _expressionAttributeValues,
      ProjectionExpression: 'deviceId,deviceName',
      ScanIndexForward: false,
    };

    let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
    try {
      let result = await docClient.query(params).promise();
      return Promise.resolve(result.Items);
    } catch (err) {
      Logger.error(Logger.levels.INFO, err);
      return Promise.reject({
        code: 500,
        error: 'UserDevicesQueryFailure',
        message: `Error occurred while attempting to retrieve devices.`,
      });
    }
  }

  async _putDeviceName(userId, _array) {
    // Gets whole devices for the user
    let devices = [];
    try {
      devices = await this._getUserDevices(userId);
    } catch (err) {
      return Promise.reject(err);
    }

    // Adding device name to the result
    for (let idx = 0; idx < _array.length; idx++) {
      let item = _array[idx];
      let device = devices.filter(device => device.deviceId === item.deviceId);
      if (device.length > 0) {
        item['deviceName'] = device[0].deviceName;
      }
      _array[idx] = item;
    }

    return Promise.resolve(_array);
  }
}

module.exports = Event;
