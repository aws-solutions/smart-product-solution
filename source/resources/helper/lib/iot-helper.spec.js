'use strict';

let assert = require('chai').assert;
let expect = require('chai').expect;
var path = require('path');
let AWS = require('aws-sdk-mock');
AWS.setSDK(path.resolve('./node_modules/aws-sdk'));

let IotHelper = require('./iot-helper.js');

describe('iotHelper', function() {
  describe('#getIotEndpoint', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('Iot');
    });

    it('should return endpoint address when describeEndpoint successful', function(done) {
      AWS.mock('Iot', 'describeEndpoint', function(params, callback) {
        callback(null, {
          endpointAddress: 'abcxyz',
        });
      });

      let _helper = new IotHelper();
      _helper
        .getIotEndpoint()
        .then(data => {
          expect(data).to.deep.equal({
            endpointAddress: 'abcxyz',
          });
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when describeEndpoint fails', function(done) {
      AWS.mock('Iot', 'describeEndpoint', function(params, callback) {
        callback(
          {
            error: 'failed',
          },
          null
        );
      });

      let _helper = new IotHelper();
      _helper
        .getIotEndpoint()
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            error: 'failed',
          });
          done();
        });
    });
  });

  describe('#getIotAnalyticsChannels', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('IoTAnalytics');
    });

    it('should return success when listChannels successful', function(done) {
      AWS.mock('IoTAnalytics', 'listChannels', function(params, callback) {
        callback(null, {
          channelSummaries: [],
        });
      });

      let _helper = new IotHelper();
      _helper
        .getIotAnalyticsChannels()
        .then(data => {
          expect(data).to.deep.equal({
            channelSummaries: [],
          });
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when listChannels fail', function(done) {
      AWS.mock('IoTAnalytics', 'listChannels', function(params, callback) {
        callback({
          error: 'failed',
        }, null);
      });

      let _helper = new IotHelper();
      _helper
        .getIotAnalyticsChannels()
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            error: 'failed',
          });
          done();
        });
    });
  });

  describe('#getAccountAuditConfiguration', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('Iot');
    });

    it('shold return sucess when describeAccountAuditConfiguration successful', function(done) {
      AWS.mock('Iot', 'describeAccountAuditConfiguration', function(params, callback) {
        callback(null, {
          "auditCheckConfigurations": {
            "LOGGING_DISABLED_CHECK": {
                "enabled": false
            },
            "REVOKED_CA_CERTIFICATE_STILL_ACTIVE_CHECK": {
                "enabled": false
            },
            "AUTHENTICATED_COGNITO_ROLE_OVERLY_PERMISSIVE_CHECK": {
                "enabled": false
            },
            "DEVICE_CERTIFICATE_EXPIRING_CHECK": {
                "enabled": false
            },
            "UNAUTHENTICATED_COGNITO_ROLE_OVERLY_PERMISSIVE_CHECK": {
                "enabled": false
            },
            "CONFLICTING_CLIENT_IDS_CHECK": {
                "enabled": false
            },
            "DEVICE_CERTIFICATE_SHARED_CHECK": {
                "enabled": false
            },
            "CA_CERTIFICATE_EXPIRING_CHECK": {
                "enabled": false
            },
            "IOT_POLICY_OVERLY_PERMISSIVE_CHECK": {
                "enabled": false
            },
            "REVOKED_DEVICE_CERTIFICATE_STILL_ACTIVE_CHECK": {
                "enabled": false
            }
          }
      });
    });

    let _helper = new IotHelper();
    _helper
      .getAccountAuditConfiguration()
      .then(data => {
        expect(data).to.deep.equal({
          "auditCheckConfigurations": {
            "LOGGING_DISABLED_CHECK": {
                "enabled": false
            },
            "REVOKED_CA_CERTIFICATE_STILL_ACTIVE_CHECK": {
                "enabled": false
            },
            "AUTHENTICATED_COGNITO_ROLE_OVERLY_PERMISSIVE_CHECK": {
                "enabled": false
            },
            "DEVICE_CERTIFICATE_EXPIRING_CHECK": {
                "enabled": false
            },
            "UNAUTHENTICATED_COGNITO_ROLE_OVERLY_PERMISSIVE_CHECK": {
                "enabled": false
            },
            "CONFLICTING_CLIENT_IDS_CHECK": {
                "enabled": false
            },
            "DEVICE_CERTIFICATE_SHARED_CHECK": {
                "enabled": false
            },
            "CA_CERTIFICATE_EXPIRING_CHECK": {
                "enabled": false
            },
            "IOT_POLICY_OVERLY_PERMISSIVE_CHECK": {
                "enabled": false
            },
            "REVOKED_DEVICE_CERTIFICATE_STILL_ACTIVE_CHECK": {
                "enabled": false
            }
          }
        });
        done();
      })
      .catch(err => {
        done(err);
      });
    });

    it('shold return error informatino when describeAccountAuditConfiguration fails', function(done) {
      AWS.mock('Iot', 'describeAccountAuditConfiguration', function(params, callback) {
        callback({
          error: 'failed',
        }, null);
      });

      let _helper = new IotHelper();
      _helper
        .getAccountAuditConfiguration()
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            error: 'failed',
          });
          done();
        });
    });
  });

  describe('#updateIoTSearchIndex', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('Iot');
    });

    it('should return success when creating updateIndexingConfiguration succeeds', function(done) {
      AWS.mock(
        'Iot', 
        'updateIndexingConfiguration', 
        Promise.resolve("Success")
      );

      let _helper = new IotHelper();
      _helper.updateIoTSearchIndex("Create")
      .then(data => {
        expect(data).to.deep.equal(
          "Success"
        );
        done();
      })
      .catch(err => {
        done(err);
      });
    });

    it('should return success when deleting updateIndexingConfiguration succeeds', function(done) {
      AWS.mock(
        'Iot', 
        'updateIndexingConfiguration', 
        Promise.resolve("Success")
      );

      let _helper = new IotHelper();
      _helper.updateIoTSearchIndex("Delete")
      .then(data => {
        expect(data).to.deep.equal(
          "Success"
        );
        done();
      })
      .catch(err => {
        done(err);
      });
    });

    it('should return error when unsupported updateIndexingConfiguration occurs', function(done) {
      AWS.mock(
        'Iot', 
        'updateIndexingConfiguration', 
        Promise.resolve("Unsupported action to update IoT search index: Unsupported")
      );

      let _helper = new IotHelper();
      _helper.updateIoTSearchIndex("Unsupported")
      .then(data => {
        done('invalid failure for negative test');
      })
      .catch(err => {
        assert.deepEqual(
          err, 
          "Unsupported action to update IoT search index: Unsupported"
        );
        done();
      });
    });
  });

  describe('#updateIoTDeviceDefender', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('Iot');
    });

    it('should return success when create audit configuration succeeds', function(done) {
      AWS.mock(
        'Iot', 
        'updateAccountAuditConfiguration',
        Promise.resolve("Success")
      );

      AWS.mock(
        'Iot',
        'createScheduledAudit',
        Promise.resolve("Success")
      )

      let _helper = new IotHelper();
      _helper.updateIoTDeviceDefender("Create", "rolArn", "targetArn", "auditRoleArn")
      .then(data => {
        expect(data).to.deep.equal(
          "Success"
        );
        done();
      })
      .catch(err => {
        done(err);
      });
    });

    it('should return success when delete audit configuration succeeds', function(done) {
      AWS.mock(
        'Iot', 
        'deleteAccountAuditConfiguration',
        Promise.resolve("Success")
      );

      let _helper = new IotHelper();
      _helper.updateIoTDeviceDefender("Delete")
      .then(data => {
        expect(data).to.deep.equal(
          "Success"
        );
        done();
      })
      .catch(err => {
        done(err);
      });
    });

    it('should return unsupported error', function(done) {
      let _helper = new IotHelper();
      _helper.updateIoTDeviceDefender("Unsupported")
      .then(data => {
        done('invalid failure for negative test');
      })
      .catch(err => {
        assert.deepEqual(
          err, 
          "Unsupported action to update IoT search index: Unsupported"
        );
        done();
      });
    });
  });

  describe('createThingType', function() {
    afterEach(function() {
      AWS.restore('Iot');
    });

    it('should return success when creating a default thing type succeds', function(done) {
      let _result = {
        thingTypeName: 'SmartProduct',
        thingTypeArn: 'thing:type:arn',
        thingTypeId: 'thingTypeId',
      };

      AWS.mock('Iot', 'createThingType', function(_params, callback) {
        callback(null, _result);
      });

      let _helper = new IotHelper();
      _helper
        .createThingType()
        .then(data => {
          assert.deepEqual(data, _result);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when creating a default thing type fails', function(done) {
      AWS.mock('Iot', 'createThingType', function(_params, callback) {
        callback('error', null);
      });

      let _helper = new IotHelper();
      _helper
        .createThingType()
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          assert.equal(err, 'Error to create a thing type');
          done();
        });
    });
  });
});
