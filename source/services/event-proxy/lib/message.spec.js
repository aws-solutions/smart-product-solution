'use strict';

let assert = require('chai').assert;
let expect = require('chai').expect;
var path = require('path');
let AWS = require('aws-sdk-mock');
// AWS.setSDK(path.resolve('./node_modules/aws-sdk'));

let Message = require('./message.js');

let message = {
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

let successUserId = {
  Items: [
    { 
      deviceId: '21c131f9-81a1-4c4f-8d3d-919803ca3234',
      userId: '6aeec314-405d-4371-b2f9-42bab52c2ea1',
      updatedAt: '2019-05-17T15:45:55.687Z',
      status: 'complete',
      activedAt: '2019-05-17T15:45:55.687Z',
      createdAt: '2019-05-17T15:45:55.687Z',
    }
  ],
  Count: 1,
  ScannedCount: 1
};

describe('Message', function() {
  beforeEach(function() {});

  describe('#createEvent', function() {
    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return event with successful create', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, successUserId);
      });
      AWS.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
        callback(null, message);
      });

      let _mm = new Message();
      _mm
        .createEvent(message)
        .then(data => {
          expect(data.deviceId).to.equal(message.deviceId);
          expect(data.messageId).to.equal(message.messageId);
          expect(data).to.have.property('id');
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when ddb put fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(params, callback) {
        callback(null, successUserId);
      });
      AWS.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
        callback('ddb error', null);
      });

      let _mm = new Message();
      _mm
        .createEvent(message)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'EventCreateFailure',
            message: `Error occurred while attempting to create event message for device ${
              message.deviceId
            }.`,
          });
          done();
        });
    });
  });
});
