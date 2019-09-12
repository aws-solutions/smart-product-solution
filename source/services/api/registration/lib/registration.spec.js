'use strict';

const assert = require('chai').assert;
const expect = require('chai').expect;
const path = require('path');
const AWS = require('aws-sdk-mock');
const sinon = require('sinon');
const sinonTest = require('sinon-test');
const test = sinonTest(sinon);
AWS.setSDK(path.resolve('./node_modules/aws-sdk'));

const Registration = require('./registration.js');

const reference = {
  details: {
    capacity: '2-5 ton',
    coolingEfficiency: 'Up to 19 SEER',
    heatingEfficiency: 'Up to 10 HSPF',
    model: 'INFINITY 19 HEAT PUMP',
    requirement: '208-230v'
  },
  deviceId: '05257e24-aec8-4581-ab6f-1b8f90207437',
  modelNumber: '25HNB9'
};

const registrationInfo = {
  activatedAt: '2018-02-06T22:58:18Z',
  createdAt: '2018-02-06T20:57:48Z',
  details: reference.details,
  userId: '085e4e22-bd06-4ca6-b913-SUBSAMPLE',
  deviceId: '05257e24-aec8-4581-ab6f-1b8f90207437',
  deviceName: 'name-of-device',
  modelNumber: '25HNB9',
  status: 'complete',
  updatedAt: '2018-02-06T20:57:48Z',
};

const newRegistration = {
  deviceId: '05257e24-aec8-4581-ab6f-1b8f90207437',
  deviceName: 'name-of-device',
  modelNumber: '25HNB9',
};

const ticket = {
  auth_status: 'authorized',
  userid: 'test_user',
  sub: '085e4e22-bd06-4ca6-b913-SUBSAMPLE',
};

describe('Registration', function() {
  describe('#listRegistrations', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return device registrations when ddb query successful with valid user', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {
          Items: [registrationInfo],
        });
      });

      let _reg = new Registration();
      _reg
        .listRegistrations(ticket)
        .then(data => {
          assert.equal(data.length, 1);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return device registrations for more data when ddb query successful with valid user', function(done) {
      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            Items: [registrationInfo],
            LastEvaluatedKey: 'key',
          });
        } else {
          callback(null, {
            Items: [registrationInfo],
          });
        }
      });

      let _reg = new Registration();
      _reg
        .listRegistrations(ticket)
        .then(data => {
          assert.equal(data.length, 2);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when ddb query fails with valid user', function(done) {
      let _calls = 0;
      let lastevalkey = 'key'
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            Items: [registrationInfo],
            LastEvaluatedKey: lastevalkey,
          });
        } else {
          callback('error', null);
        }
      });

      let userId = ticket.sub;
      let _reg = new Registration();
      _reg
        .listRegistrations(ticket)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'RegistrationListRetrievalFailure',
            message: `Error occurred while attempting to retrieve registrations.`,
          });
          done();
        });
    });
  });

  describe('#createRegistration', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    // 1. pass
    it('should return sucess when device registration is successful', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          Item: reference
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback(null, {
          Items: []
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'put', function(_params, callback) {
        callback(null, 'success');
      });

      AWS.mock('Iot', 'createThing', function(_params, callback) {
        callback(null, 'success');
      });

      let _reg = new Registration();
      _reg
        .createRegistration(ticket, newRegistration)
        .then(data => {
          assert.exists(data.deviceName);
          assert.exists(data.modelNumber);
          assert.exists(data.userId);
          assert.exists(data.createdAt);
          assert.exists(data.updatedAt);
          assert.exists(data.status);
          assert.equal(data.deviceId, newRegistration.deviceId);
          assert.deepEqual(data.details, reference.details);

          AWS.restore('Iot');
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    // 2. no reference device error
    it('should return error information when device is not registered on the reference table', function(done) {
      let error = {
        code: 400,
        error: 'DeviceNotFoundFailure',
        message: `Manufacturer info cannot be found for serial number "${newRegistration.deviceId}" and model number "${newRegistration.modelNumber
          }". Please add a model number/serial number that is supported by the manufacturer.`
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {});
      });

      let _reg = new Registration();
      _reg
        .createRegistration(ticket, newRegistration)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          assert.deepEqual(err, error);
          done();
        });
    });

    // 3. already registered error
    it('should return error information when device is already registered', function(done) {
      let error = {
        code: 500,
        error: 'DeviceRegisteredFailure',
        message: `Device with serial number "${newRegistration.deviceId}" has been already registered.`
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          Item: reference
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback(null, {
          Items: [registrationInfo]
        });
      });

      let _reg = new Registration();
      _reg
        .createRegistration(ticket, newRegistration)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          assert.deepEqual(err, error);
          done();
        });
    });

    // 4. get reference error
    it('should return error information when ddb get fails - reference', function(done) {
      let error = {
        code: 500,
        error: 'RetrieveReferenceFailure',
        message: `Error occurred while retrieving device: deviceId "${newRegistration.deviceId}", modelNumber "${newRegistration.modelNumber}".`
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback('error', null);
      });

      let _reg = new Registration();
      _reg
        .createRegistration(ticket, newRegistration)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          assert.deepEqual(err, error);
          done();
        });
    });

    // 5. get registration error
    it('should return error information when ddb get fails - registration', function(done) {
      let error = {
        code: 500,
        error: 'RetrieveRegistrationFailure',
        message: `Error occurred while retrieving device "${newRegistration.deviceId}".`
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          Item: reference
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback('error', null);
      });

      let _reg = new Registration();
      _reg
        .createRegistration(ticket, newRegistration)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          assert.deepEqual(err, error);
          done();
        });
    });

    // 6. put error
    it('should return error when ddb put fails', function(done) {
      let error = {
        code: 500,
        error: 'RegistrationCreateFailure',
        message: `Error occurred while attempting to create registration for device "${newRegistration.deviceId}".`,
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          Item: reference
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback(null, {
          Items: []
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'put', function(_params, callback) {
        callback('error', null);
      });

      let _reg = new Registration();
      _reg
        .createRegistration(ticket, newRegistration)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal(error);
          done();
        });
    });

    // 7. create thing error
    it('should return error when create thing fails', function(done) {
      let error = {
        code: 500,
        error: 'CreateThingFailure',
        message: `Error occurred while attempting to create thing for device "${registrationInfo.deviceId}".`,
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          Item: reference
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback(null, {
          Items: []
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'put', function(_params, callback) {
        callback(null, 'success');
      });

      AWS.mock('Iot', 'createThing', function(_params, callback) {
        callback('error', null);
      });

      AWS.mock('DynamoDB.DocumentClient', 'delete', function(_params, callback) {
        callback(null, 'success');
      });

      let _reg = new Registration();
      _reg
        .createRegistration(ticket, newRegistration)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.be.deep.equal(error);
          AWS.restore('Iot');
          done();
        });
    });

    // 8. roll back error
    it('should return error when roll back ddb fails', function(done) {
      let error = {
        code: 500,
        error: 'DeviceRollBackFailure',
        message: `Error occurred while rolling back the device "${newRegistration.deviceId}" registration.`,
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          Item: reference
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback(null, {
          Items: []
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'put', function(_params, callback) {
        callback(null, 'success');
      });

      AWS.mock('Iot', 'createThing', function(_params, callback) {
        callback('error', null);
      });

      AWS.mock('DynamoDB.DocumentClient', 'delete', function(_params, callback) {
        callback('error', null);
      });

      let _reg = new Registration();
      _reg
        .createRegistration(ticket, newRegistration)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.be.deep.equal(error);
          AWS.restore('Iot');
          done();
        });
    });
  });
});
