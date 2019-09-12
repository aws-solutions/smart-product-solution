'use strict';

const AWS = require('aws-sdk-mock');
const moment = require('moment');
const sinon = require('sinon');
const sinonTest = require('sinon-test');
const test = sinonTest(sinon);
const expect = require('chai').expect;

const lib = require('./index.js');
const Message = require('./message.js');

describe('Index', function() {
  let _event = {
    deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
    status: 'ACK',
    commandId: '11advd4d-ccd1-4zw0-a459-6trfpq0fa454',
  };

  it(
    'should return event message with successful library Message updateStatus response',
    test(async function() {
      let _resp = {
        ..._event,
      };
      _resp.updatedAt = moment()
        .utc()
        .format();

      const stub = this.stub(Message.prototype, 'statusUpdate');
      stub.resolves(_resp);
      try {
        const data = await lib.response(_event);
        expect(data.deviceId).to.equal(_resp.deviceId);
        expect(data.commandId).to.equal(_resp.commandId);
        expect(data.status).to.equal(_resp.status);
        expect(data).to.have.property('updatedAt');
      } catch (err) {
        console.log('negative test: ', err);
      }
    })
  );

  it(
    'should return error with failed library Message updateStatus response',
    test(async function() {
      const _resp = {
        code: 500,
        error: 'StatusUpdateFailure',
        message: `Error occurred while updating command status for device ${
          _event.deviceId
        } command ${_event.commandId}.`,
      };
      const stub = this.stub(Message.prototype, 'statusUpdate');
      stub.rejects(_resp);
      try {
        await lib.response(_event);
      } catch (err) {
        expect(err).to.be.deep.equal(_resp);
      }
    })
  );
});
