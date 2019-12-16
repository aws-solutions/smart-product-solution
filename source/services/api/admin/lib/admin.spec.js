'use strict'

const AWS = require('aws-sdk-mock');
const expect = require('chai').expect;

const AdminManager = require('./admin.js');

describe('Admin', function() {
  const _ddbResult = {
    Item: {
      settingId: 'app-config',
      setting: {
        idp: 'pool-config-id'
      }
    }
  };

  const _settingId = 'app-config';

  const _setting = {
    some: 'setting'
  };

  describe('#getSettings', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return success when ddb get succeeds', function(done) {
      let result = {
        Item: {
          setting: {
            alertLevel: [
              'error',
              'warning',
            ]
          },
        },
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, result);
      });

      let _adminManager = new AdminManager();
      _adminManager
        .getSettings(_settingId)
        .then(data=> {
          expect(data).to.deep.equal(result.Item);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when ddb get returns empty', function(done) {
      let error = {
        code: 400,
        error: 'MissingSetting',
        message: `The setting ${_settingId} does not exist.`
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {});
      });

      let _adminManager = new AdminManager();
      _adminManager
        .getSettings(_settingId)
        .then(_data=> {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal(error);
          done();
        });
    });

    it('should return error information when ddb get fails', function(done) {
      let error = {
        code: 500,
        error: 'SettingRetrievalFailure',
        message: `Error occurred while attempting to retrieve the setting ${_settingId}.`
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(error, null);
      });

      let _adminManager = new AdminManager();
      _adminManager
        .getSettings(_settingId)
        .then(_data=> {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal(error);
          done();
        });
    });
  });

  describe('#updateSetting', function() {
    it('should return success when update settings succeed', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, _ddbResult);
      });

      AWS.mock('DynamoDB.DocumentClient', 'put', function(_params, callback) {
        callback(null, 'success');
      });

      let _adminManager = new AdminManager();
      _adminManager
        .updateSetting(_settingId, _setting)
        .then(data => {
          AWS.restore('DynamoDB.DocumentClient');
          expect(data).to.deep.equal('success');
          done();
        })
        .catch(err => {
          AWS.restore('DynamoDB.DocumentClient');
          done(err);
        });
    });

    it('should return error information when setting is missing', function(done) {
      let setting = undefined;
      let error = {
        code: 400,
        error: 'InvalidSetting',
        message: `The requested setting is invalid: ${JSON.stringify(setting)}`
      };

      let _adminManager = new AdminManager();
      _adminManager
        .updateSetting(_settingId, setting)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal(error);
          done();
        });
    });

    it('should return error information when ddb get returns empty', function(done) {
      let error = {
        code: 400,
        error: 'MissingSetting',
        message: `The requested setting ${_settingId} does not exist.`
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {});
      });

      AWS.mock('DynamoDB.DocumentClient', 'put', function(_params, callback) {
        callback(null, 'success');
      });

      let _adminManager = new AdminManager();
      _adminManager
        .updateSetting(_settingId, _setting)
        .then(_data => {
          AWS.restore('DynamoDB.DocumentClient');
          done('invalid failure for negative test');
        })
        .catch(err => {
          AWS.restore('DynamoDB.DocumentClient');
          expect(err).to.deep.equal(error);
          done();
        });
    });

    it('should return error information when ddb get fails', function(done) {
      let error = {
        code: 500,
        error: 'SettingRetrievalFailure',
        message: `Error occurred while attempting to retrieve the setting ${_settingId}.`
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(error, null);
      });

      AWS.mock('DynamoDB.DocumentClient', 'put', function(_params, callback) {
        callback(null, 'success');
      });

      let _adminManager = new AdminManager();
      _adminManager
        .updateSetting(_settingId, _setting)
        .then(_data => {
          AWS.restore('DynamoDB.DocumentClient');
          done('invalid failure for negative test');
        })
        .catch(err => {
          AWS.restore('DynamoDB.DocumentClient');
          expect(err).to.deep.equal(error);
          done();
        });
    });

    it('should return error information when ddb put fails', function(done) {
      let error = {
        code: 500,
        error: 'SettingUpdateFailure',
        message: `Error occurred while attempting to update setting ${_setting.settingId}.`
      };

      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, _ddbResult);
      });

      AWS.mock('DynamoDB.DocumentClient', 'put', function(_params, callback) {
        callback(error, null);
      });

      let _adminManager = new AdminManager();
      _adminManager
        .updateSetting(_settingId, _setting)
        .then(_data => {
          AWS.restore('DynamoDB.DocumentClient');
          done('invalid failure for negative test');
        })
        .catch(err => {
          AWS.restore('DynamoDB.DocumentClient');
          expect(err).to.deep.equal(error);
          done();
        });
    });
  });
});