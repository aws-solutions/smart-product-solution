'use strict';

const sinon = require('sinon');
const sinonTest = require('sinon-test');
const test = sinonTest(sinon);
let assert = require('chai').assert;
let expect = require('chai').expect;
let path = require('path');
let AWS = require('aws-sdk-mock');
AWS.setSDK(path.resolve('./node_modules/aws-sdk'));

let Command = require('./command.js');

describe('Command', function() {
  const deviceId = '42adad4d-fdd1-4db0-a501-61cffd0fa3e4';

  const command = {
    deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
    commandId: '82bfgd4y-uu81-io10-a602-56cnb0fhs34',
    createdAt: '2018-02-06T20:57:48Z',
    commandDetails: {
      command: 'set-temp',
      value: 70,
    },
    shadowDetails: {
      powerStatus: 'HEAT',
      actualTemperature: 60,
      targetTemperature: 70,
    },
    userId: '085e4e22-bd06-4ca6-b913-8b0b6bf154c1',
    status: 'pending',
    updatedAt: '2018-02-06T20:57:48Z',
  };

  const ticket = {
    auth_status: 'authorized',
    userid: 'test_user',
    sub: '085e4e22-bd06-4ca6-b913-SUBSAMPLE',
    groups: [],
  };

  describe('#getCommands', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return device commands when ddb query successful with valid user', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, {
          userId: ticket.sub,
          deviceId: command.deviceId,
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {
          Items: [command],
        });
      });

      let lastevalkey = 'null';
      let commandStatus = '';
      let _command = new Command();
      _command
        .getCommands(ticket, lastevalkey, deviceId, commandStatus)
        .then(data => {
          assert.equal(data.Items.length, 1);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return device commands for particular LastEvaludatedKey when ddb query successful with valid user', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, {
          userId: ticket.sub,
          deviceId: command.deviceId,
        });
      });

      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {
          Items: [command],
        });
      });

      let lastevalkey = {key: 'key'};
      let commandStatus = '';
      let _command = new Command();
      _command
        .getCommands(ticket, lastevalkey, deviceId, commandStatus)
        .then(data => {
          assert.equal(data.Items.length, 1);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return device commands for specific command status when ddb query successful with valid user', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, {
          userId: ticket.sub,
          deviceId: command.deviceId,
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {
          Items: [command],
        });
      });

      let lastevalkey = 'null';
      let commandStatus = 'success';
      let _command = new Command();
      _command
        .getCommands(ticket, lastevalkey, deviceId, commandStatus)
        .then(data => {
          assert.equal(data.Items.length, 1);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when ddb query fails with valid user', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, {
          userId: ticket.sub,
          deviceId: command.deviceId,
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback('error', null);
      });

      let lastevalkey = 'null';
      let commandStatus = '';
      let _command = new Command();
      _command
        .getCommands(ticket, lastevalkey, deviceId, commandStatus)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'CommandQueryFailure',
            message: `Error occurred while attempting to retrieve commands for device "${deviceId}".`,
          });
          done();
        });
    });

    it('should return error information when registration validation fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback('error', null);
      });

      let lastevalkey = 'null';
      let commandStatus = '';
      let _command = new Command();
      _command
        .getCommands(ticket, lastevalkey, deviceId, commandStatus)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'RegistrationRetrieveFailure',
            message: `Error occurred while attempting to retrieve registration information for device "${deviceId}".`,
          });
          done();
        });
    });

    it('should return error information when no registration validation records retrieved', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, []);
      });

      let lastevalkey = 'null';
      let commandStatus = '';
      let _command = new Command();
      _command
        .getCommands(ticket, lastevalkey, deviceId, commandStatus)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingRegistration',
            message: `No registration found for device "${deviceId}".`,
          });
          done();
        });
    });

    it('should return success when no registration validation records retrieved but user is admin', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, []);
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, {
          Items: [command],
        });
      });

      let lastevalkey = 'null';
      let commandStatus = '';
      let _command = new Command();
      _command
        .getCommands(ticket, lastevalkey, deviceId, commandStatus)
        .then(data => {
          assert.deepEqual(data[0], command);
          done();
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingRegistration',
            message: `No registration found for device "${deviceId}".`,
          });
          done();
        });
    });
  });

  describe('#getCommand', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return device command when ddb get successful with valid registration', function(done) {
      let _calls = 0;
      ticket.groups = [];
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            userId: ticket.userid,
            deviceId: command.deviceId,
          });
        } else {
          callback(null, {
            Item: command,
          });
        }
      });

      let _command = new Command();
      _command
        .getCommand(ticket, command.deviceId, command.id)
        .then(data => {
          assert.equal(data, command);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when ddb get returns empty result with valid registration', function(done) {
      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            userId: ticket.userid,
            deviceId: command.deviceId,
          });
        } else {
          callback(null, {});
        }
      });

      let _command = new Command();
      _command
        .getCommand(ticket, command.deviceId, command.id)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingCommand',
            message: `The command "${command.id}" for device "${command.deviceId}" does not exist.`,
          });
          done();
        });
    });

    it('should return error information when ddb get fails with valid registration', function(done) {
      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            userId: ticket.userid,
            deviceId: command.deviceId,
          });
        } else {
          callback('error', null);
        }
      });

      let _command = new Command();
      _command
        .getCommand(ticket, command.deviceId, command.id)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'CommandRetrieveFailure',
            message: `Error occurred while attempting to retrieve command "${command.id}" for device "${command.deviceId}".`,
          });
          done();
        });
    });

    it('should return error information when registration validation fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback('error', null);
      });

      let _command = new Command();
      _command
        .getCommand(ticket, command.deviceId, command.id)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'CommandRetrieveFailure',
            message: `Error occurred while attempting to retrieve command "${command.id}" for device "${command.deviceId}".`,
          });
          done();
        });
    });

    it('should return error information when no registration validation records retrieved', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, []);
      });
      let _command = new Command();
      _command
        .getCommand(ticket, deviceId, command.id)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingRegistration',
            message: `No registration found for device "${deviceId}".`,
          });
          done();
        });
    });

    it('should return success when no registration validation records retrieved but user is admin', function(done) {
      let _calls = 0;
      ticket.groups = ['Admin'];
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, []);
        } else {
          callback(null, {
            Item: command,
          });
        }
      });
      let _command = new Command();
      _command
        .getCommand(ticket, deviceId, command.id)
        .then(data => {
          assert.deepEqual(data, command);
          done();
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingRegistration',
            message: `No registration found for device "${deviceId}".`,
          });
          done();
        });
    });
  });

  describe('#createCommand', function() {
    beforeEach(function() {});

    afterEach(function() {});

    it(
      'should return new device command when ddb put successful with valid registration',
      test(function(done) {
        let _command = new Command();
        AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
          callback(null, {
            userId: ticket.sub,
            deviceId: command.deviceId,
          });
        });

        AWS.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
          callback(null, {
            Item: command,
          });
        });

        const stub = this.stub(Command.prototype, 'shadowUpdate');
        stub.resolves();

        const stub2 = this.stub(Command.prototype, 'publishCommand');
        stub2.resolves();

        _command
          .createCommand(ticket, deviceId, command)
          .then(data => {
            AWS.restore('DynamoDB.DocumentClient');
            assert.exists(data.commandId);
            assert.exists(data.userId);
            assert.exists(data.createdAt);
            assert.exists(data.updatedAt);
            assert.equal(data.deviceId, deviceId);
            done();
          })
          .catch(err => {
            AWS.restore('DynamoDB.DocumentClient');
            done(err);
          });
      })
    );

    it(
      'should return error when shadow update fails',
      test(function(done) {
        let _command = new Command();
        AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
          callback(null, {
            userId: ticket.sub,
            deviceId: command.deviceId,
          });
        });

        AWS.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
          callback(null, {
            Item: command,
          });
        });

        const stub = this.stub(Command.prototype, 'shadowUpdate');
        stub.rejects('showdow update error');

        _command
          .createCommand(ticket, deviceId, command)
          .then(_data => {
            AWS.restore('DynamoDB.DocumentClient');
            done('negative test');
          })
          .catch(err => {
            AWS.restore('DynamoDB.DocumentClient');
            expect(err).to.be.deep.equal({
              code: 500,
              error: 'CommandCreateFailure',
              message: `Error occurred while attempting to create command for device "${command.deviceId}".`,
            });
            done();
          });
      })
    );

    it(
      'should return error when publish on IoT topic fails',
      test(function(done) {
        let _command = new Command();
        AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
          callback(null, {
            userId: ticket.sub,
            deviceId: command.deviceId,
          });
        });

        AWS.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
          callback(null, {
            Item: command,
          });
        });

        const stub = this.stub(Command.prototype, 'shadowUpdate');
        stub.resolves();

        const stub2 = this.stub(Command.prototype, 'publishCommand');
        stub2.rejects('error in publishing to IoT topic');

        _command
          .createCommand(ticket, deviceId, command)
          .then(data => {
            AWS.restore('DynamoDB.DocumentClient');
            done('negative test');
          })
          .catch(err => {
            AWS.restore('DynamoDB.DocumentClient');
            expect(err).to.be.deep.equal({
              code: 500,
              error: 'CommandCreateFailure',
              message: `Error occurred while attempting to create command for device "${command.deviceId}".`,
            });
            done();
          });
      })
    );

    it('should return error when registration validation fails', function(done) {
      ticket.groups = [];
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback('error', null);
      });

      let _command = new Command();
      _command
        .createCommand(ticket, deviceId, command)
        .then(data => {
          AWS.restore('DynamoDB.DocumentClient');
          done('negative test');
        })
        .catch(err => {
          AWS.restore('DynamoDB.DocumentClient');
          assert.deepEqual(err, {
            code: 500,
            error: 'CommandCreateFailure',
            message: `Error occurred while attempting to create command for device "${deviceId}".`,
          });
          done();
        });
    });

    it('should return error when no valid registration found', function(done) {
      ticket.groups = [];
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, []);
      });

      let _command = new Command();
      _command
        .createCommand(ticket, deviceId, command)
        .then(data => {
          AWS.restore('DynamoDB.DocumentClient');
          done('negative test');
        })
        .catch(err => {
          AWS.restore('DynamoDB.DocumentClient');
          assert.deepEqual(err, {
            code: 400,
            error: 'MissingRegistration',
            message: `No registration found for device "${deviceId}".`,
          });
          done();
        });
    });

    it('should return error when commandDetails is missing', function(done) {
      let invliadCommand = {
        deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
        commandId: '82bfgd4y-uu81-io10-a602-56cnb0fhs34',
        createdAt: '2018-02-06T20:57:48Z',
        shadowDetails: {
          powerStatus: 'HEAT',
          actualTemperature: 60,
          targetTemperature: 70,
        },
        userId: '085e4e22-bd06-4ca6-b913-8b0b6bf154c1',
        status: 'pending',
        updatedAt: '2018-02-06T20:57:48Z',
      };

      let _command = new Command();
      _command
        .createCommand(ticket, deviceId, invliadCommand)
        .then(() => {
          done('negative test');
        })
        .catch(err => {
          assert.deepEqual(err, {
            code: 400,
            error: 'InvalidParameter',
            message: 'Body parameters are invalid. Please check the API specification.',
          });
          done();
        });
    });

    it('should return error when shadowDetails is missing', function(done) {
      let invliadCommand = {
        deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
        commandId: '82bfgd4y-uu81-io10-a602-56cnb0fhs34',
        createdAt: '2018-02-06T20:57:48Z',
        commandDetails: {
          command: 'set-temp',
          value: 70,
        },
        userId: '085e4e22-bd06-4ca6-b913-8b0b6bf154c1',
        status: 'pending',
        updatedAt: '2018-02-06T20:57:48Z',
      };

      let _command = new Command();
      _command
        .createCommand(ticket, deviceId, invliadCommand)
        .then(() => {
          done('negative test');
        })
        .catch(err => {
          assert.deepEqual(err, {
            code: 400,
            error: 'InvalidParameter',
            message: 'Body parameters are invalid. Please check the API specification.',
          });
          done();
        });
    });

    it('should return error when command is invalid', function(done) {
      let invliadCommand = {
        deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
        commandId: '82bfgd4y-uu81-io10-a602-56cnb0fhs34',
        createdAt: '2018-02-06T20:57:48Z',
        commandDetails: {
          command: 'set-invalid',
          value: 70,
        },
        shadowDetails: {
          powerStatus: 'HEAT',
          actualTemperature: 60,
          targetTemperature: 70,
        },
        userId: '085e4e22-bd06-4ca6-b913-8b0b6bf154c1',
        status: 'pending',
        updatedAt: '2018-02-06T20:57:48Z',
      };

      let _command = new Command();
      _command
        .createCommand(ticket, deviceId, invliadCommand)
        .then(() => {
          done('negative test');
        })
        .catch(err => {
          assert.deepEqual(err, {
            code: 400,
            error: 'InvalidParameter',
            message: 'Body parameters are invalid. Please check the API specification.',
          });
          done();
        });
    });

    it('should return error when value is not number to set temperature', function(done) {
      let invliadCommand = {
        deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
        commandId: '82bfgd4y-uu81-io10-a602-56cnb0fhs34',
        createdAt: '2018-02-06T20:57:48Z',
        commandDetails: {
          command: 'set-temp',
          value: 'wrong',
        },
        shadowDetails: {
          powerStatus: 'HEAT',
          actualTemperature: 60,
          targetTemperature: 70,
        },
        userId: '085e4e22-bd06-4ca6-b913-8b0b6bf154c1',
        status: 'pending',
        updatedAt: '2018-02-06T20:57:48Z',
      };

      let _command = new Command();
      _command
        .createCommand(ticket, deviceId, invliadCommand)
        .then(() => {
          done('negative test');
        })
        .catch(err => {
          assert.deepEqual(err, {
            code: 400,
            error: 'InvalidParameter',
            message: 'Body parameters are invalid. Please check the API specification.',
          });
          done();
        });
    });

    it('should return error when power status is not valid', function(done) {
      let invliadCommand = {
        deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
        commandId: '82bfgd4y-uu81-io10-a602-56cnb0fhs34',
        createdAt: '2018-02-06T20:57:48Z',
        commandDetails: {
          command: 'set-temp',
          value: '70',
        },
        shadowDetails: {
          powerStatus: 'wrong',
          actualTemperature: 60,
          targetTemperature: 70,
        },
        userId: '085e4e22-bd06-4ca6-b913-8b0b6bf154c1',
        status: 'pending',
        updatedAt: '2018-02-06T20:57:48Z',
      };

      let _command = new Command();
      _command
        .createCommand(ticket, deviceId, invliadCommand)
        .then(() => {
          done('negative test');
        })
        .catch(err => {
          assert.deepEqual(err, {
            code: 400,
            error: 'InvalidParameter',
            message: 'Body parameters are invalid. Please check the API specification.',
          });
          done();
        });
    });

    it('should return error when target temperature is not number', function(done) {
      let invliadCommand = {
        deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
        commandId: '82bfgd4y-uu81-io10-a602-56cnb0fhs34',
        createdAt: '2018-02-06T20:57:48Z',
        commandDetails: {
          command: 'set-temp',
          value: 70,
        },
        shadowDetails: {
          powerStatus: 'HEAT',
          actualTemperature: 60,
          targetTemperature: 'string',
        },
        userId: '085e4e22-bd06-4ca6-b913-8b0b6bf154c1',
        status: 'pending',
        updatedAt: '2018-02-06T20:57:48Z',
      };

      let _command = new Command();
      _command
        .createCommand(ticket, deviceId, invliadCommand)
        .then(() => {
          done('negative test');
        })
        .catch(err => {
          assert.deepEqual(err, {
            code: 400,
            error: 'InvalidParameter',
            message: 'Body parameters are invalid. Please check the API specification.',
          });
          done();
        });
    });

    it('should return error when target temperature is not within the acceptable number', function(done) {
      let invliadCommand = {
        deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
        commandId: '82bfgd4y-uu81-io10-a602-56cnb0fhs34',
        createdAt: '2018-02-06T20:57:48Z',
        commandDetails: {
          command: 'set-temp',
          value: 70,
        },
        shadowDetails: {
          powerStatus: 'HEAT',
          actualTemperature: 60,
          targetTemperature: 0,
        },
        userId: '085e4e22-bd06-4ca6-b913-8b0b6bf154c1',
        status: 'pending',
        updatedAt: '2018-02-06T20:57:48Z',
      };

      let _command = new Command();
      _command
        .createCommand(ticket, deviceId, invliadCommand)
        .then(() => {
          done('negative test');
        })
        .catch(err => {
          assert.deepEqual(err, {
            code: 400,
            error: 'InvalidParameter',
            message: 'Body parameters are invalid. Please check the API specification.',
          });
          done();
        });
    });
  });

  describe('#shadowUpdate', function() {
    beforeEach(function() {
    });

    afterEach(function() {
      AWS.restore('Iot');
      AWS.restore('IotData');
    });

    const _command = new Command();

    it('check for success when IoT APIs successful', function(done) {
      AWS.mock(
        'Iot',
        'describeEndpoint',
        Promise.resolve({endpointAddress: 'testEndpoint.amazonaws.com'})
      );

      AWS.mock(
        'IotData',
        'getThingShadow',
        Promise.resolve({payload: {version: 1}})
      );

      AWS.mock(
        'IotData',
        'updateThingShadow',
        Promise.resolve('success')
      );

      _command.shadowUpdate(command, command.shadowDetails)
        .then(data => {
          expect(data).equal('success');
          done();
        })
        .catch(err => {
          done(err);
        })
    });

    it('check for error when getThingShadow fails', function(done) {
      AWS.mock(
        'Iot',
        'describeEndpoint',
        Promise.resolve({endpointAddress: 'testEndpoint.amazonaws.com'})
      );

      AWS.mock('IotData', 'getThingShadow', function(_params, callback) {
        callback('error', null);
      });

      _command.shadowUpdate(command, command.shadowDetails)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'DeviceShadowUpdateFailure',
            message: `Error occurred while attempting to update device shadow for command "${command.deviceId}".`,
          });
          done();
        })
    });

    it('check for error when updateThingShadow fails', function(done) {
      AWS.mock(
        'Iot',
        'describeEndpoint',
        Promise.resolve({endpointAddress: 'testEndpoint.amazonaws.com'})
      );

      AWS.mock(
        'IotData',
        'getThingShadow',
        Promise.resolve({payload: {version: 1}})
      );

      AWS.mock('IotData', 'updateThingShadow', function(_params, callback) {
        callback('error', null);
      });

      _command.shadowUpdate(command, command.commandDetails)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'DeviceShadowUpdateFailure',
            message: `Error occurred while attempting to update device shadow for command "${command.deviceId}".`,
          });
          done();
        });
    });
  });

  describe('#publishCommand', function() {
    afterEach(function() {
      AWS.restore('Iot');
      AWS.restore('IotData');
    });
    const _command = new Command();

    it('check for success when IoT APIs successful', function(done) {
      AWS.mock(
        'Iot',
        'describeEndpoint',
        Promise.resolve({endpointAddress: 'testEndpoint.amazonaws.com'})
      );

      AWS.mock(
        'IotData',
        'publish',
        Promise.resolve('command published on IoT topic')
      );

      _command.publishCommand(command, command.shadowDetails)
        .then(data => {
          expect(data).to.equal('command published on IoT topic');
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('check for error when publish fails on IoT topic', function(done) {
      AWS.mock(
        'Iot',
        'describeEndpoint',
        Promise.resolve({endpointAddress: 'testEndpoint.amazonaws.com'})
      );

      AWS.mock('IotData', 'publish', function(_params, callback) {
        callback('error', null);
      });

      _command.publishCommand(command, command.shadowDetails)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          assert.deepEqual(err, {
            code: 500,
            error: 'CommandPublishFailure',
            message: `Error occurred while attempting to publish command "${command.commandId}".`,
          });
          done();
        });
    });
  });
});
