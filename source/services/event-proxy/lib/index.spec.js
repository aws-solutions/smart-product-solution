'use strict';

const sinon = require('sinon');
const assert = require('chai').assert;
const expect = require('chai').expect;
const path = require('path');
const AWS = require('aws-sdk-mock');
//AWS.setSDK(path.resolve('./node_modules/aws-sdk'));

const lib = require('./index.js');
const Message = require('./message.js');

let sandbox;

describe('Index', function() {
  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('should return event message with successful library Message createEvent response', function(done) {
    const _event = {
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

    let _resp = {
      ..._event,
    };
    _resp.id = 123;

    sandbox.stub(Message.prototype, 'createEvent').resolves(_resp);
    AWS.mock('Lambda', 'invoke', Promise.resolve());

    lib
      .response(_event)
      .then(data => {
        expect(data.deviceId).to.equal(_event.deviceId);
        expect(data.messageId).to.equal(_event.messageId);
        expect(data).to.have.property('id');
        done();
        AWS.restore('Lambda');
      })
      .catch(err => {
        done(err);
      });
  });

  it('should return error with failed library Message createEvent response', function(done) {
    const _event = {
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

    let _resp = {
      code: 500,
      error: 'EventCreateFailure',
      message: `Error occurred while attempting to create event message for device ${
        _event.deviceId
      }.`,
    };

    sandbox.stub(Message.prototype, 'createEvent').rejects(_resp);
    AWS.mock('Lambda', 'invoke', Promise.resolve());

    lib
      .response(_event)
      .then(data => {
        done('invalid failure for negative test');
      })
      .catch(err => {
        expect(err).to.deep.equal(_resp);
        AWS.restore('Lambda');
        done();
      });
  });

  it('should return error for failed lambda invocation', function(done) {
    const _event = {
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

    let _resp = {
      code: 500,
      error: 'LambdaInvocationFailed',
      message: `Error occurred while invoking lambda function.`,
    };

    sandbox.stub(Message.prototype, 'createEvent').resolves();
    AWS.mock('Lambda', 'invoke', Promise.reject(_resp));

    lib
      .response(_event)
      .then(data => {
        done('invalid failure for negative test');
      })
      .catch(err => {
        expect(err).to.deep.equal(_resp);
        AWS.restore('Lambda');
        done();
      });
  });
});
