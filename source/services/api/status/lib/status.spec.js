'use strict';

let assert = require('chai').assert;
let expect = require('chai').expect;
var path = require('path');
let AWS = require('aws-sdk-mock');
AWS.setSDK(path.resolve('./node_modules/aws-sdk'));

let Status = require('./status.js');

const deviceStatus = {
  deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
  temp: 69.2,
  status: 'heat',
  humidy: 30.4,
  fanspeed: 480,
};

const ticket = {
  auth_status: 'authorized',
  userid: 'test_user',
  sub: '085e4e22-bd06-4ca6-b913-SUBSAMPLE',
};

describe('Status', function() {
  describe('#getDeviceStatus', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    const _shadow = {
      state: {
        reported: {
          temp: 100,
          fanspeed: 255,
        },
      },
      version: 10,
    };

    const _device = { 
      nextToken: null,
      things: [ 
        { 
          thingName: 'e908ebc2-1db9-487f-97c3-ac72dfe1930d',
          thingId: '7877775c-6341-4def-b755-57ce7ddbda29',
          thingTypeName: null,
          attributes: [Object],
          shadow: [String],
          connectivity: {
            connected: true
          }
        } 
      ] 
    };

    it('should return device status when iot getThingShadow successful with valid registration', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, {
          userId: ticket.userid,
          deviceId: deviceStatus.deviceId,
        });
      });

      AWS.mock(
        'Iot',
        'describeEndpoint',
        Promise.resolve({endpointAddress: 'testEndpoint.amazonaws.com'})
      );

      AWS.mock(
        'IotData',
        'getThingShadow',
        Promise.resolve({payload: _shadow})
      );

      AWS.mock('Iot', 'searchIndex', Promise.resolve(_device));

      let _status = new Status();
      _status
        .getDeviceStatus(ticket, deviceStatus.deviceId)
        .then(data => {
          expect(data).to.deep.equal(_shadow);
          AWS.restore('Iot');
          AWS.restore('IotData');
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when registration validation fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback('error', null);
      });

      let _status = new Status();
      _status
        .getDeviceStatus(ticket, deviceStatus.deviceId)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'StatusRetrieveFailure',
            message: `Error occurred while attempting to retrieve status for device "${deviceStatus.deviceId}".`,
          });
          done();
        });
    });

    it('should return error information when no registration validation records retrieved', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, []);
      });

      let _status = new Status();
      _status
        .getDeviceStatus(ticket, deviceStatus.deviceId)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingRegistration',
            message: `No registration found for device "${deviceStatus.deviceId}".`,
          });
          done();
        });
    });

    it('should return error information when iot getThingShadow fails with valid registration', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, {
          userId: ticket.userid,
          deviceId: deviceStatus.deviceId,
        });
      });

      AWS.mock(
        'Iot',
        'describeEndpoint',
        Promise.resolve({endpointAddress: 'testEndpoint.amazonaws.com'})
      );

      AWS.mock(
        'IotData',
        'getThingShadow',
        Promise.reject('error in getting thing shadow')
      );

      AWS.mock('Iot', 'searchIndex', Promise.resolve(_device));

      let _status = new Status();
      _status
        .getDeviceStatus(ticket, deviceStatus.deviceId)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          assert.deepEqual(err, {
            code: 500,
            error: 'StatusRetrieveFailure',
            message: `Error occurred while attempting to retrieve status for device "${deviceStatus.deviceId}".`,
          });
          AWS.restore('Iot');
          AWS.restore('IotData');
          done();
        });
    });
  });
});
