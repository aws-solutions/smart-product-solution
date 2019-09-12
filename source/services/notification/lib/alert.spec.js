'use strict';

let expect = require('chai').expect;
const sinon = require('sinon');
const sinonTest = require('sinon-test');
const test = sinonTest(sinon);
let AWS = require('aws-sdk-mock');
let Alert = require('./alert.js');

describe('Alert', function() {
  let _event = {
    createdAt: '2018-02-06T20:57:48Z',
    deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
    messageId: '085e4e22-bd06-4ca6-b913-8b0b6bf154c1',
    message: 'R-410A refrigerant pressure exceeding upper threshold',
    details: {
      type: 'warning',
      eventId: 'R-410A-UT',
      sensorId: 'cps-1234',
      sensor: 'coolant pressure switch',
      value: 612,
    },
    type: 'warning',
    sentAt: '2018-02-06T20:57:48Z',
  };

  let _userSettingItem = {
    createdAt: '2019-03-25T23:57:02Z',
    setting: {
      alertLevel: [
        'error',
        'warning',
      ],
      sendNotification: true
    },
    settingId: '8b9eb653-4f00-45c6-8a82-d80e1c6d4baq', //this is userId
    updatedAt: '2019-03-25T23:57:02Z',
  };

  const _cognitoUserAttributes = [
    {Name: 'phone_number', Value: '+11230000111'},
  ];

  const _registrationItem = {
    devicedId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
    userId: '8b9eb653-4f00-45c6-8a82-d80e1c6d4baq',
    status: 'complete'
  };

  afterEach(function() {
    AWS.restore();
  });

  it(
    'should return succes when alert sent for warning event',
    test(async function() {
      AWS.mock('SNS', 'publish', Promise.resolve());
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {Items: [_registrationItem]});
      });
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, {Item: _userSettingItem});
      });
      AWS.mock(
        'CognitoIdentityServiceProvider',
        'listUsers',
        Promise.resolve({Users: [{Attributes: _cognitoUserAttributes}]})
      );
      const _a = new Alert();

      try {
        const data = await _a.sendAlert(_event);
        expect(data).to.be.deep.equal({
          code: 200,
          message: `alert sent for device "${_event.deviceId}".`,
        });
      } catch (e) {
        throw new Error(e.message);
      }
    })
  );

  it(
    'should return error information when device registration not found',
    test(async function() {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {Items: []});
      });

      const _a = new Alert();

      try {
        await _a.sendAlert(_event);
      } catch (e) {
        expect(e).to.be.deep.equal({
          code: 400,
          error: 'MissingRegistration',
          message: `No registration found for user for device "${_event.deviceId}".`,
        });
      }
    })
  );

  it(
    'should return error information when user setting not found',
    test(async function() {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {Items: [_registrationItem]});
      });

      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, {});
      });

      AWS.mock(
        'CognitoIdentityServiceProvider',
        'listUsers',
        Promise.resolve({Users: [{Attributes: _cognitoUserAttributes}]})
      );

      const _a = new Alert();

      try {
        await _a.sendAlert(_event);
      } catch (e) {
        expect(e).to.be.deep.equal({
          code: 400,
          error: 'MissingUserConfig',
          message: `No user settings found.`,
        });
      }
    })
  );

  it(
    'should return error information when user phone_number not found',
    test(async function() {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {Items: [_registrationItem]});
      });

      AWS.mock(
        'CognitoIdentityServiceProvider',
        'listUsers',
        Promise.resolve({Users: [{Attributes: []}]})
      );

      const _a = new Alert();

      try {
        await _a.sendAlert(_event);
      } catch (e) {
        expect(e).to.be.deep.equal({
          code: 400,
          error: 'MissingPhoneNumber',
          message: `No phone number found.`,
        });
      }
    })
  );

  it(
    'should not send alert when user defined threshold does not match event type',
    test(async function() {
      _userSettingItem.setting.alertLevel = ['info'];
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {Items: [_registrationItem]});
      });

      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, {Item: _userSettingItem});
      });

      AWS.mock(
        'CognitoIdentityServiceProvider',
        'listUsers',
        Promise.resolve({Users: [{Attributes: _cognitoUserAttributes}]})
      );

      const _a = new Alert();

      try {
        const data = await _a.sendAlert(_event);
        expect(data).to.be.deep.equal({
          code: 200,
          message: `alert not sent for device "${_event.deviceId}" event type "${_event.type}".`,
        });
      } catch (e) {
        throw new Error(e);
      }
    })
  );

  it(
    'should not send alert when user defined not sending SMS',
    test(async function() {
      _userSettingItem.setting.sendNotification = false;
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {Items: [_registrationItem]});
      });

      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, {Item: _userSettingItem});
      });

      AWS.mock(
        'CognitoIdentityServiceProvider',
        'listUsers',
        Promise.resolve({Users: [{Attributes: _cognitoUserAttributes}]})
      );

      const _a = new Alert();

      try {
        const data = await _a.sendAlert(_event);
        expect(data).to.be.deep.equal({
          code: 200,
          message: `alert not sent for device "${_event.deviceId}" event type "${_event.type}".`,
        });
      } catch (e) {
        throw new Error(e);
      }
    })
  );

  it(
    'should return failure when alert not sent due to sns failure',
    test(async function() {
      _userSettingItem.setting.alertLevel = ['warning', 'error'];
      _userSettingItem.setting.sendNotification = true;
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {Items: [_registrationItem]});
      });

      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, {Item: _userSettingItem});
      });

      AWS.mock(
        'CognitoIdentityServiceProvider',
        'listUsers',
        Promise.resolve({Users: [{Attributes: _cognitoUserAttributes}]})
      );

      AWS.mock('SNS', 'publish', Promise.reject());
      const _a = new Alert();

      try {
        await _a.sendAlert(_event);
      } catch (e) {
        expect(e).to.be.deep.equal({
          code: 500,
          error: 'SendAlertFailure',
          message: `Error occurred while attempting to send event alert for device "${_event.deviceId}".`,
        });
      }
    })
  );

  it(
    'should return failure when validate registration api fails',
    test(async function() {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback('error', null);
      });

      const _a = new Alert();

      try {
        await _a.sendAlert(_event);
      } catch (e) {
        expect(e).to.be.deep.equal({
          code: 500,
          error: 'SendAlertFailure',
          message: `Error occurred while attempting to send event alert for device "${_event.deviceId}".`,
        });
      }
    })
  );

  it(
    'should return failure when cognito api fails',
    test(async function() {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {Items: [_registrationItem]});
      });
      AWS.mock('CognitoIdentityServiceProvider', 'listUsers', Promise.reject());
      const _a = new Alert();

      try {
        await _a.sendAlert(_event);
      } catch (e) {
        expect(e).to.be.deep.equal({
          code: 500,
          error: 'SendAlertFailure',
          message: `Error occurred while attempting to send event alert for device "${_event.deviceId}".`,
        });
      }
    })
  );

  it(
    'should return failure when dynamodb api fails to get user config',
    test(async function() {
      _userSettingItem.setting.alertLevel = ['warning', 'error'];
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {Items: [_registrationItem]});
      });

      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback('error', null);
      });

      AWS.mock(
        'CognitoIdentityServiceProvider',
        'listUsers',
        Promise.resolve({Users: [{Attributes: _cognitoUserAttributes}]})
      );

      const _a = new Alert();

      try {
        await _a.sendAlert(_event);
      } catch (e) {
        expect(e).to.be.deep.equal({
          code: 500,
          error: 'SendAlertFailure',
          message: `Error occurred while attempting to send event alert for device "${_event.deviceId}".`,
        });
      }
    })
  );
});
