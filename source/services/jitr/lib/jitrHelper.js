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
const AWS = require('aws-sdk');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const moment = require('moment');

/**
 * @class Jitr Performs Just-In-Time-Registration with device initial connection
 */
class JITRHelper {
  /**
   * @class Jitr
   * @constructor
   */
  constructor() {
    this.creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
    this.dynamoConfig = {
      credentials: this.creds,
      region: process.env.AWS_REGION,
    };
  }

  async createPolicy(policyDoc, policyN) {
    const iot = new AWS.Iot({
      region: process.env.AWS_REGION,
      apiVersion: '2015-05-28',
    });
    try {
      await iot
        .createPolicy({
          policyDocument: policyDoc /* required */,
          policyName: policyN /* required */,
        })
        .promise();
    } catch (e) {
      if (e && (!e.code || e.code !== 'ResourceAlreadyExistsException'))
        throw new Error(e);
    }
  }

  async attachPolicy(policyDoc, policyN, certArn) {
    const iot = new AWS.Iot({
      region: process.env.AWS_REGION,
      apiVersion: '2015-05-28',
    });
    const _self = this;

    try {
      await _self.createPolicy(policyDoc, policyN);
      await iot
        .attachPrincipalPolicy({
          policyName: policyN /* required */,
          principal: certArn /* required */,
        })
        .promise();
    } catch (e) {
      if (e && (!e.code || e.code !== 'ResourceAlreadyExistsException'))
        throw new Error(e);
    }
  }

  async attachThing(certId, certArn) {
    const _self = this;
    const iot = new AWS.Iot({
      region: process.env.AWS_REGION,
      apiVersion: '2015-05-28',
    });
    try {
      await iot
        .updateCertificate({
          certificateId: certId,
          newStatus: 'ACTIVE',
        })
        .promise();
      //get certificatePem and read subject to identify common name/thingName
      const data = await iot
        .describeCertificate({certificateId: certId})
        .promise();
      fs.writeFileSync(
        '/tmp/deviceCert.pem',
        data.certificateDescription.certificatePem
      );
      // get Thing Name
      const thingName = await _self.openssl();
      await iot
        .attachThingPrincipal({
          principal: certArn,
          thingName: thingName,
        })
        .promise();
      await _self._registrationUpdate(thingName);
    } catch (e) {
      throw new Error(e);
    }
  }

  async openssl() {
    try {
      const data = await exec(
        'openssl x509 -noout -subject -in /tmp/deviceCert.pem'
      );
      const regexCN = /CN=[\w-]+/g; //get CommonName from cert
      const found = data.stdout.match(regexCN);
      return found[0].split('=')[1];
    } catch (e) {
      throw new Error(e);
    }
  }

  async _registrationUpdate(thing) {
    try {
      let _keyConditionExpression = 'deviceId = :did';
      let _expressionAttributeValues = {
        ':did': thing,
      };

      let params = {
        TableName: process.env.REGISTRATION_TBL,
        IndexName: 'deviceId-index',
        KeyConditionExpression: _keyConditionExpression,
        ExpressionAttributeValues: _expressionAttributeValues,
      };

      let docClient = new AWS.DynamoDB.DocumentClient(this.dynamoConfig);
      let data = await docClient.query(params).promise();
      let devices = data.Items.filter(device => device.status === 'pending');
      if (devices.length === 0) {
        Logger.error(
          Logger.levels.INFO,
          `[DeviceNotFoundFailure] Device ${thing} has not registered.`
        );

        return Promise.reject({
          code: 400,
          error: 'DeviceNotFoundFailure',
          message: `Device ${thing} has not registered.`
        });
      }
      
      let device = devices[0];
      params = {
        TableName: process.env.REGISTRATION_TBL,
        Key: {
          deviceId: thing,
          userId: device.userId,
        },
        ExpressionAttributeNames: {
          '#A': 'activatedAt',
          '#U': 'updatedAt',
          '#S': 'status',
        },
        ExpressionAttributeValues: {
          ':a': moment().utc().format(),
          ':u': moment().utc().format(),
          ':s': 'complete',
        },
        UpdateExpression: 'SET #A = :a, #U = :u, #S = :s',
      };
  
      await docClient.update(params).promise();
      return Promise.resolve({
        code: 200,
        error: 'RegistrationUpdateSuccess',
        message: `Success in updating registration for device ${thing}.`,
      });
    } catch (err) {
      if (err.error === 'DeviceNotFoundFailure') {
        return Promise.reject(err);
      }

      Logger.error(Logger.levels.INFO, err);
      Logger.error(
        Logger.levels.INFO,
        `[RegistrationUpdateFailure] Error occurred while updating registration for device ${thing}.`
      );

      return Promise.reject({
        code: 500,
        error: 'RegistrationUpdateFailure',
        message: `Error occurred while updating registration for device ${thing}.`,
      });
    }
  }
}

module.exports = JITRHelper;
