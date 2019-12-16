'use strict';

let assert = require('chai').assert;
let expect = require('chai').expect;
var path = require('path');
let AWS = require('aws-sdk-mock');
let AWS_SDK = require('aws-sdk');
AWS.setSDK(path.resolve('./node_modules/aws-sdk'));

let DeviceManager = require('./device.js');

describe('Device', function() {
  const ticket = {
    auth_status: 'authorized',
    userid: 'test_user',
    sub: '085e4e22-bd06-4ca6-b913-SUBSAMPLE',
  };

  const device = {
    Item: {
      activatedAt: "2018-02-06T22:58:18Z",
      createdAt: "2018-02-06T20:57:48Z",
      details: {
        model: "INFINITY 19 HEAT PUMP",
        modelNumber: "25HNB9",
        capacity: "2-5 ton",
        requirement: "208-230 V",
        coolingEfficiency: "Up to 19 SEER",
        heatingEfficiency: "Up to 10 HSPF"
      },
      userId: "085e4e22-bd06-4ca6-b913-SUBSAMPLE",
      deviceId: "085e4e22-bd06-4ca6-b913-8b0b6bf154c1",
      status: "complete",
      updatedAt: "2018-02-06T20:57:48Z"
    }
  };

  const iotDevice = {
    thingId: "23da892a-0268-49d8-9a7b-c8548b4605f1",
    thingArn: "arn:aws:iot:region:accountId:thing/something",
    attributes: {
        modelNumber: "model-number",
        userId: "085e4e22-bd06-4ca6-b913-SUBSAMPLE",
        deviceName: "deviceName"
    },
    thingName: "something",
    defaultClientId: "something",
    version: 1
  };


  const devices = {
    things: [
      {
        thingName: "MyThing",
        thingId: "b0f4eae4-16f3-49f4-8db3-7e61acda3c8b",
        thingTypeName: null,
        attributes: {
          modelNumber: "model-number",
          userId: "085e4e22-bd06-4ca6-b913-SUBSAMPLE",
          deviceName: "deviceName"
        },
        shadow: null
      },
    ],
    nextToken: null,
  };

  describe('#getDevices', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('Iot');
    });

    it('should return devices when searching index is successful with valid user', function(done) {
      AWS.mock('Iot', 'searchIndex', function(_params, callback) {
        callback(null, devices);
      });

      let _deviceManager = new DeviceManager();
      _deviceManager
        .getDevices(ticket)
        .then(data => {
          assert.equal(data.length, 1);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return SearchDeviceFailure error when IoT search fails', function(done) {
      let error = {
        code: 500,
        error: 'DevicesRetrieveFailure',
        message: `Error occurred while attempting to search devices.`
      };

      AWS.mock('Iot', 'searchIndex', function(_params, callback) {
        callback('error', null);
      });

      let _deviceManager = new DeviceManager();
      _deviceManager
        .getDevices(ticket)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal(error);
          done();
        });
    });
  });

  describe('#getDevice', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return device information when ddb get successful', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, device);
      });

      let _deviceManager = new DeviceManager();
      _deviceManager
        .getDevice(ticket, device.Item.deviceId)
        .then(data => {
          assert.deepEqual(data, device.Item);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when ddb get returns empty result', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {});
      });

      let _deviceManager = new DeviceManager();
      _deviceManager
        .getDevice(ticket, device.Item.deviceId)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingDevice',
            message: `The device "${device.Item.deviceId}" does not exist.`
          });
          done();
        });
    });

    it('should return error information when ddb get fails', function(done) {
      let error = {
        code: 500,
        error: 'DeviceRetrieveFailure',
        message: `Error occurred while attempting to retrieve device "${device.Item.deviceId}".`
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(error, null);
      });

      let _deviceManager = new DeviceManager();
      _deviceManager
        .getDevice(ticket, device.Item.deviceId)
        .then(_data => {
          done('invalid failur for negative test');
        })
        .catch(err => {
          assert.deepEqual(err, error);
          done();
        });
    });
  });

  describe('#deleteDevice', function() {
    const error = {
      code: 500,
      error: 'DeviceDeleteFailure',
      message: `Error occurred while attempting to delete device "${device.Item.deviceId}".`,
    };

    const principals = {
      principals: [
          "arn:aws:iot:region:xxxxxxxxxxxx:cert/some-cert-example-id"
      ]
    };

    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return when device deletes successfully', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, device);
      });
      AWS.mock('DynamoDB.DocumentClient', 'put', function(_params, callback) {
        callback(null, 'success');
      });
      AWS.mock('Iot', 'describeThing', function(_params, callback) {
        callback(null, iotDevice);
      });
      AWS.mock('Iot', 'listThingPrincipals', function(_params, callback) {
        callback(null, principals);
      });
      AWS.mock('Iot', 'detachThingPrincipal', function(_params, callback) {
        callback(null, 'success');
      });
      AWS.mock('Iot', 'updateCertificate', function(_params, callback) {
        callback(null, 'success');
      });
      AWS.mock('Iot', 'deleteCertificate', function(_params, callback) {
        callback(null, 'success');
      });
      AWS.mock('Iot', 'deletePolicy', function(_params, callback) {
        callback(null, 'success');
      });      
      AWS.mock('Iot', 'deleteThing', function(_params, callback) {
        callback(null, 'success');
      });

      let _deviceManager = new DeviceManager();
      _deviceManager
        .deleteDevice(ticket, device.Item.deviceId)
        .then(data => {
          AWS.restore('Iot');
          assert.equal('Delete successful', data);
          done();
        })
        .catch(err => {
          AWS.restore('Iot');
          done(err);
        });
    });

    it('should return error information when the device does not exist', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {});
      });
      AWS.mock('Iot', 'describeThing', function(_params, callback) {
        callback({code: 'ResourceNotFoundException'}, null);
      });

      let _deviceManager = new DeviceManager();
      _deviceManager
        .deleteDevice(ticket, device.Item.deviceId)
        .then(_data => {
          AWS.restore('Iot');
          done('invalid failur for negative test');
        })
        .catch(err => {
          AWS.restore('Iot');
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingDevice',
            message: `The device "${device.Item.deviceId}" does not exist.`
          });
          done();
        });
    });

    it('should return error information when ddb error occurs', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback('error', null);
      });

      let _deviceManager = new DeviceManager();
      _deviceManager
        .deleteDevice(ticket, device.Item.deviceId)
        .then(_data => {
          done('invalid failur for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal(error);
          done();
        });
    });

    it('should return error information when iot error occurs', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, device);
      });
      AWS.mock('DynamoDB.DocumentClient', 'put', function(_params, callback) {
        callback(null, 'success');
      });
      AWS.mock('Iot', 'describeThing', function(_params, callback) {
        callback(null, iotDevice);
      });
      AWS.mock('Iot', 'listThingPrincipals', function(_params, callback) {
        callback(null, principals);
      });
      AWS.mock('Iot', 'detachThingPrincipal', function(_params, callback) {
        callback(null, 'success');
      });
      AWS.mock('Iot', 'updateCertificate', function(_params, callback) {
        callback(null, 'success');
      });
      AWS.mock('Iot', 'deleteCertificate', function(_params, callback) {
        callback(null, 'success');
      });
      AWS.mock('Iot', 'deletePolicy', function(_params, callback) {
        callback(null, 'success');
      });      
      AWS.mock('Iot', 'deleteThing', function(_params, callback) {
        callback('error', null);
      });

      let _deviceManager = new DeviceManager();
      _deviceManager
        .deleteDevice(ticket, device.Item.deviceId)
        .then(_data => {
          AWS.restore('Iot');
          done('invalid failur for negative test');
        })
        .catch(err => {
          AWS.restore('Iot');
          expect(err).to.deep.equal(error);
          done();
        });
    });
  });
});