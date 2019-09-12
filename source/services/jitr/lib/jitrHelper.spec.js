'use strict';

const JITRHelper = require('./jitrHelper');
const expect = require('chai').expect;
const assert = require('chai').assert;
const sinon = require('sinon');
const sinonTest = require('sinon-test');
const test = sinonTest(sinon);
const AWS = require('aws-sdk-mock');

describe('JITR module', function() {
  /**
   * @unit-test createPolicy
   */
  describe('#createPolicy method', function() {
    it('#TDD, validate method', function() {
      expect(new JITRHelper().createPolicy).to.be.a('function');
    });

    it(
      '#TDD, validate error handling',
      test(async function() {
        const _jitrHelper = new JITRHelper();
        AWS.mock(
          'Iot',
          'createPolicy',
          Promise.reject('createPolicy failure scenario')
        );
        try {
          await _jitrHelper.createPolicy('policyDoc', 'policyN');
        } catch (err) {
          assert.deepEqual(err.message, 'createPolicy failure scenario');
        }
        AWS.restore('Iot');
      })
    );

    it(
      '#BDD, resource already exists scenario',
      test(async function() {
        const _jitrHelper = new JITRHelper();
        AWS.mock(
          'Iot',
          'createPolicy',
          Promise.reject({code: 'ResourceAlreadyExistsException'})
        );
        try {
          await _jitrHelper.createPolicy('policyDoc', 'policyN');
          console.log('ResourceAlreadyExistsException success scenario');
        } catch (err) {}
        AWS.restore('Iot');
      })
    );
  });

  /**
   * @unit-test attachPolicy
   */
  describe('#attachPolicy method', function() {
    after(function() {
      AWS.restore('Iot');
    });

    it('#TDD, validate method', function() {
      expect(new JITRHelper().attachPolicy).to.be.a('function');
    });

    it(
      '#TDD, validate error handling',
      test(async function() {
        const _jitrHelper = new JITRHelper();
        AWS.mock(
          'Iot',
          'attachPrincipalPolicy',
          Promise.reject('attachPrincipalPolicy failure scenario')
        );
        const _stub = this.stub(_jitrHelper, 'createPolicy');
        _stub.resolves();
        try {
          await _jitrHelper.attachPolicy('policyDoc', 'policyN', 'certArn');
        } catch (err) {
          assert.deepEqual(
            err.message,
            'attachPrincipalPolicy failure scenario'
          );
        }
        AWS.restore('Iot');
      })
    );

    it(
      '#BDD, resource already exists scenario',
      test(async function() {
        const _jitrHelper = new JITRHelper();
        AWS.mock(
          'Iot',
          'attachPrincipalPolicy',
          Promise.reject({code: 'ResourceAlreadyExistsException'})
        );
        const _stub = this.stub(_jitrHelper, 'createPolicy');
        _stub.resolves();
        try {
          await _jitrHelper.attachPolicy('policyDoc', 'policyN', 'certArn');
          console.log('ResourceAlreadyExistsException success');
        } catch (err) {}
        AWS.restore('Iot');
      })
    );

    it(
      '#BDD, create policy error',
      test(async function() {
        const _jitrHelper = new JITRHelper();
        AWS.mock('Iot', 'attachPrincipalPolicy', Promise.resolve());
        const _stub = this.stub(_jitrHelper, 'createPolicy');
        _stub.rejects('createPolicy error');
        try {
          await _jitrHelper.attachPolicy('policyDoc', 'policyN', 'certArn');
        } catch (err) {
          assert.deepEqual(err.message, 'createPolicy error');
        }
      })
    );
  });

  /**
   * @unit-test attachThing
   */
  describe('#attachThing', function() {
    after(function() {
      AWS.restore('Iot');
    });

    it('#TDD, validate method', function() {
      expect(new JITRHelper().attachThing).to.be.a('function');
    });

    it(
      '#TDD, validate error handling',
      test(async function() {
        const _jitrHelper = new JITRHelper();
        AWS.mock(
          'Iot',
          'attachThingPrincipal',
          Promise.reject('attachThing failure scenario')
        );
        AWS.mock('Iot', 'updateCertificate', Promise.resolve());
        AWS.mock(
          'Iot',
          'describeCertificate',
          Promise.resolve({certificateDescription: {certificatePem: 'test'}})
        );
        const _stub = this.stub(_jitrHelper, 'openssl');
        _stub.resolves('testThing');
        try {
          await _jitrHelper.attachThing('certId', 'certArn');
        } catch (err) {
          assert.deepEqual(err.message, 'attachThing failure scenario');
        }
        AWS.restore('Iot');
      })
    );

    it(
      '#TDD, validate error handling for updateCertificate',
      test(async function() {
        const _jitrHelper = new JITRHelper();
        AWS.mock(
          'Iot',
          'updateCertificate',
          Promise.reject('updateCertificate error')
        );
        try {
          await _jitrHelper.attachThing('certId', 'certArn');
        } catch (err) {
          assert.deepEqual(err.message, 'updateCertificate error');
        }
        AWS.restore('Iot');
      })
    );

    it(
      '#TDD, validate error handling for describeCertificate',
      test(async function() {
        const _jitrHelper = new JITRHelper();
        AWS.mock('Iot', 'updateCertificate', Promise.resolve());
        AWS.mock(
          'Iot',
          'describeCertificate',
          Promise.reject('describeCertificate error')
        );
        try {
          await _jitrHelper.attachThing('certId', 'certArn');
        } catch (err) {
          assert.deepEqual(err.message, 'describeCertificate error');
        }
        AWS.restore('Iot');
      })
    );

    it(
      '#TDD, validate error handling for openssl',
      test(async function() {
        const _jitrHelper = new JITRHelper();
        AWS.mock('Iot', 'updateCertificate', Promise.resolve());
        AWS.mock(
          'Iot',
          'describeCertificate',
          Promise.resolve({certificateDescription: {certificatePem: 'test'}})
        );
        const _stub = this.stub(_jitrHelper, 'openssl');
        _stub.rejects('openssl error');
        try {
          await _jitrHelper.attachThing('certId', 'certArn');
        } catch (err) {
          assert.deepEqual(err.message, 'openssl error');
        }
      })
    );
  });

  /**
   * @unit-test openssl
   */
  describe('#openSSL', function() {
    it('#TDD, validate method', function() {
      expect(new JITRHelper().openssl).to.be.a('function');
    });

    it(
      '#TDD, validate error handling',
      test(async function() {
        const _jitrHelper = new JITRHelper();
        try {
          await _jitrHelper.openssl();
        } catch (err) {
          console.log('Invalid cert error');
        }
      })
    );
  });

  /**
   * @unit-test _registrationUpdate
   *
   */
  describe('#registrationUpdate', function() {
    let thing = 'testDevice';
    let device = {
      deviceId: thing,
      deviceName: 'deviceName',
      status: 'pending',
    };

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('#TDD, validate method', function(done) {
      expect(new JITRHelper()._registrationUpdate).to.be.a('function');
      done();
    });

    // Success
    it('#BDD, validate success information', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback(null, {
          Items: [device],
        });
      });
      AWS.mock('DynamoDB.DocumentClient', 'update', function(_params, callback) {
        callback(null, 'succuess');
      });

      let _jitrHelper = new JITRHelper();
      _jitrHelper
        ._registrationUpdate(thing)
        .then(data => {
          expect(data).to.deep.equal({
            code: 200,
            error: 'RegistrationUpdateSuccess',
            message: `Success in updating registration for device ${thing}.`,
          });
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    // Device not found
    it('should return error information when there is not device found', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback(null, {
          Items: [],
        });
      });

      let _jitrHelper = new JITRHelper();
      _jitrHelper
        ._registrationUpdate(thing)
        .then(_data => {
          done('invalid test for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'DeviceNotFoundFailure',
            message: `Device ${thing} has not registered.`,
          });
          done();
        });
    });

    // Get error
    it('should return error information when ddb get fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback('error', null);
      });

      let _jitrHelper = new JITRHelper();
      _jitrHelper
        ._registrationUpdate(thing)
        .then(_data => {
          done('invalid test for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'RegistrationUpdateFailure',
            message: `Error occurred while updating registration for device ${thing}.`,
          });
          done();
        });
    });

    // Update error
    it('should return error informatino when ddb update fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback(null, {
          Items: [device],
        });
      });
      AWS.mock('DynamoDB.DocumentClient', 'update', function(_params, callback) {
        callback('error', null);
      });

      let _jitrHelper = new JITRHelper();
      _jitrHelper
        ._registrationUpdate(thing)
        .then(_data => {
          done('invalid test for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'RegistrationUpdateFailure',
            message: `Error occurred while updating registration for device ${thing}.`,
          });
          done();
        });
    });
  });
});
