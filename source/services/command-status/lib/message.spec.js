'use strict';

let expect = require('chai').expect;
let AWS = require('aws-sdk-mock');
const sinon = require('sinon');
const sinonTest = require('sinon-test');
const test = sinonTest(sinon);

let Message = require('./message.js');

let message = {
  deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
  status: 'ACK',
  commandId: '11advd4d-ccd1-4zw0-a459-6trfpq0fa454',
};

describe('Message', function() {
  beforeEach(function() {});

  describe('#statusUpdate', function() {
    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it(
      'should return event with successful update',
      test(async function() {
        AWS.mock('DynamoDB.DocumentClient', 'update', Promise.resolve());

        let _m = new Message();
        try {
          const data = await _m.statusUpdate(message);
          expect(data.deviceId).to.equal(message.deviceId);
          expect(data.commandId).to.equal(message.commandId);
          expect(data.status).to.equal(message.status);
          expect(data).to.have.property('updatedAt');
        } catch (e) {
          console.log(e);
        }
      })
    );

    it(
      'should return error information when ddb update fails',
      test(async function() {
        AWS.mock('DynamoDB.DocumentClient', 'update', Promise.reject());

        let _m = new Message();
        try {
          await _m.statusUpdate(message);
        } catch (e) {
          expect(e).to.be.deep.equal({
            code: 500,
            error: 'StatusUpdateFailure',
            message: `Error occurred while updating command status for device ${
              message.deviceId
            } command ${message.commandId}.`,
          });
        }
      })
    );
  });
});
