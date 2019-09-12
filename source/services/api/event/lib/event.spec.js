'use strict';

let assert = require('chai').assert;
let expect = require('chai').expect;
var path = require('path');
let AWS = require('aws-sdk-mock');
AWS.setSDK(path.resolve('./node_modules/aws-sdk'));

let EventManager = require('./event.js');

describe('Event', function() {
  const event = {
    createdAt: '2018-02-06T20:57:48Z',
    deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
    messageId: '085e4e22-bd06-4ca6-b913-8b0b6bf154c1',
    message: 'R-410A refrigerant pressure exceeding upper threshold',
    details: {
      type: 'warning',
      eventId: 'R-410A-UT',
      sensorId: 'cps-1234',
      sensor: 'coolant pressure switch',
      value: '612',
    },
    id: '42adad4d-fdd1-4db0-a501-SAMPLE',
    timestamp: 1538763670,
    type: 'warning',
    sentAt: '2018-02-06T20:57:48Z',
    ack: false,
    suppress: false,
    userId: '085e4e22-bd06-4ca6-b913-SUBSAMPLE',
  };

  const ticket = {
    auth_status: 'authorized',
    userid: 'test_user',
    sub: '085e4e22-bd06-4ca6-b913-SUBSAMPLE',
  };

  describe('#getEvents', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return device events when ddb query successful with valid user', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          userId: ticket.userid,
          deviceId: event.deviceId,
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback(null, {
          Items: [event],
        });
      });

      let _eventManager = new EventManager();
      let lastevalkey = 'null';
      let eventType = '';

      _eventManager
        .getEvents(ticket, lastevalkey, event.deviceId, eventType)
        .then(data => {
          assert.equal(data.Items.length, 1);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when ddb query fails with valid user', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          userId: ticket.userid,
          deviceId: event.deviceId,
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback('error', null);
      });

      let _eventManager = new EventManager();
      let lastevalkey = 'null';
      let eventType = '';

      _eventManager
        .getEvents(ticket, lastevalkey, event.deviceId, eventType)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'EventQueryFailure',
            message: `Error occurred while attempting to retrieve events for device "${event.deviceId}".`
          });
          done();
        });
    });

    it('should return error information when registration validation fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback('error', null);
      });

      let _eventManager = new EventManager();
      let lastevalkey = null;
      let eventType = '';

      _eventManager
        .getEvents(ticket, lastevalkey, event.deviceId, eventType)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'RegistrationRetrieveFailure',
            message: `Error occurred while attempting to retrieve registration information for device "${event.deviceId}".`,
          });
          done();
        });
    });

    it('should return error information when no registration validation records retrieved', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, []);
      });

      let _eventManager = new EventManager();
      let lastevalkey = null;
      let eventType = '';

      _eventManager
        .getEvents(ticket, lastevalkey, event.deviceId, eventType)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingRegistration',
            message: `No registration found for device "${event.deviceId}".`,
          });
          done();
        });
    });
  });

  describe('#getEvent', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return device event when ddb get successful with valid registration', function(done) {
      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            userId: ticket.userid,
            deviceId: event.deviceId,
          });
        } else {
          callback(null, {
            Item: event,
          });
        }
      });

      let _eventManager = new EventManager();
      _eventManager
        .getEvent(ticket, event.deviceId, event.id)
        .then(data => {
          assert.equal(data, event);
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
            deviceId: event.deviceId,
          });
        } else {
          callback(null, {});
        }
      });

      let _eventManager = new EventManager();
      _eventManager
        .getEvent(ticket, event.deviceId, event.id)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingEvent',
            message: `The event "${event.id}" for device "${event.deviceId}" does not exist.`,
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
            deviceId: event.deviceId,
          });
        } else {
          callback('error', null);
        }
      });

      let _eventManager = new EventManager();
      _eventManager
        .getEvent(ticket, event.deviceId, event.id)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'EventRetrieveFailure',
            message: `Error occurred while attempting to retrieve event "${event.id}" for device "${event.deviceId}".`,
          });
          done();
        });
    });

    it('should return error information when registration validation fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback('error', null);
      });

      let _eventManager = new EventManager();
      _eventManager
        .getEvent(ticket, event.deviceId, event.id)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'EventRetrieveFailure',
            message: `Error occurred while attempting to retrieve event "${event.id}" for device "${event.deviceId}".`,
          });
          done();
        });
    });

    it('should return error information when no registration validation records retrieved', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, []);
      });

      let _eventManager = new EventManager();
      _eventManager
        .getEvent(ticket, event.deviceId, event.id)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingRegistration',
            message: `No registration found for device "${event.deviceId}".`,
          });
          done();
        });
    });
  });

  describe('#updateEvent', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return updated device event when ddb put successful with valid registration', function(done) {
      let _uEvent = {
        ...event,
      };
      _uEvent.ack = true;
      _uEvent.suppress = true;
      _uEvent.updatedAt = 'DATE';

      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            userId: ticket.sub,
            deviceId: event.deviceId,
          });
        } else {
          callback(null, {
            Item: event,
          });
        }
      });

      AWS.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
        callback(null, _uEvent);
      });

      let _eventManager = new EventManager();
      _eventManager
        .updateEvent(ticket, event.deviceId, event)
        .then(data => {
          expect(data.ack).to.equal(_uEvent.ack);
          expect(data.suppress).to.equal(_uEvent.suppress);
          expect(data.deviceId).to.equal(_uEvent.deviceId);
          expect(data).to.have.property('updatedAt');
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error when device event when ddb put fails with valid registration', function(done) {
      let _uEvent = {
        ...event,
      };
      _uEvent.ack = true;
      _uEvent.suppress = true;
      _uEvent.updatedAt = 'DATE';

      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            userId: ticket.sub,
            deviceId: event.deviceId,
          });
        } else {
          callback(null, {
            Item: event,
          });
        }
      });

      AWS.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
        callback('error', null);
      });

      let _eventManager = new EventManager();
      _eventManager
        .updateEvent(ticket, event.deviceId, event)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'EventUpdateFailure',
            message: `The event "${event.id}" for device "${event.deviceId}" failed to update.`,
          });
          done();
        });
    });

    it('should return error information when ddb get returns empty result with valid registration', function(done) {
      let _uEvent = {
        ...event,
      };
      _uEvent.ack = true;
      _uEvent.suppress = true;
      _uEvent.updatedAt = 'DATE';

      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            userId: ticket.sub,
            deviceId: event.deviceId,
          });
        } else {
          callback(null, {});
        }
      });

      let _eventManager = new EventManager();
      _eventManager
        .updateEvent(ticket, event.deviceId, event)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'EventUpdateFailure',
            message: `The event "${event.id}" for device "${event.deviceId}" failed to update.`,
          });
          done();
        });
    });

    it('should return error information when ddb get fails with valid registration', function(done) {
      let _uEvent = {
        ...event,
      };
      _uEvent.ack = true;
      _uEvent.suppress = true;
      _uEvent.updatedAt = 'DATE';

      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            userId: ticket.sub,
            deviceId: event.deviceId,
          });
        } else {
          callback('error', null);
        }
      });

      let _eventManager = new EventManager();
      _eventManager
        .updateEvent(ticket, event.deviceId, event)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'EventUpdateFailure',
            message: `The event "${event.id}" for device "${event.deviceId}" failed to update.`,
          });
          done();
        });
    });

    it('should return error information when registration validation fails', function(done) {
      let _uEvent = {
        ...event,
      };
      _uEvent.ack = true;
      _uEvent.suppress = true;
      _uEvent.updatedAt = 'DATE';

      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback('error', null);
      });

      let _eventManager = new EventManager();
      _eventManager
        .updateEvent(ticket, event.deviceId, event)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'EventUpdateFailure',
            message: `The event "${event.id}" for device "${event.deviceId}" failed to update.`,
          });
          done();
        });
    });

    it('should return error information when no registration validation records retrieved', function(done) {
      let _uEvent = {
        ...event,
      };
      _uEvent.ack = true;
      _uEvent.suppress = true;
      _uEvent.updatedAt = 'DATE';

      AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
        callback(null, []);
      });

      let _eventManager = new EventManager();
      _eventManager
        .updateEvent(ticket, event.deviceId, event)
        .then(data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingRegistration',
            message: `No registration found for device "${event.deviceId}".`,
          });
          done();
        });
    });
  });

  describe('#getEventHistory', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return event history successfully', function(done) {
      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            Items: [event],
            LastEvaluatedKey: {key: 'key'},
          });          
        } else if (_calls === 1) {
          _calls++;
          callback(null, {
            Items: [
              event, event, event, event, event, event, event, event, event, event,
              event, event, event, event, event, event, event, event, event, event,
            ],
            LastEvaludatedKey: {key: 'key'},
          })
        } else {
          callback(null, {
            Items: [
              {
                deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
                deviceName: 'device-1',
              }
            ]
          });
        }
      });

      let _eventManager = new EventManager();
      let lastevalkey = null;
      let deviceId = '';
      let eventType = '';

      _eventManager
        .getEventHistory(ticket, lastevalkey, deviceId, eventType)
        .then(data => {
          assert.equal(data.Items.length, 21);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when retrieving event history fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback('error', null);
      });

      let _eventManager = new EventManager();
      let lastevalkey = null;
      let deviceId = '';
      let eventType = '';

      _eventManager
        .getEventHistory(ticket, lastevalkey, deviceId, eventType)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'EventHistoryQueryFailure',
            message: 'Error occurred while attempting to retrieve event history.',
          });
          done();
        });
    });
  });

  describe('#getAlerts', function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    it('should return alerts successfully', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          Item: {
            setting: {
              alertLevel: [
                'error',
                'warning',
              ]
            }
          }
        });
      });

      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            Items: [event],
          });          
        } else {
          callback(null, {
            Items: [
              {
                deviceId: '42adad4d-fdd1-4db0-a501-61cffd0fa3e4',
                deviceName: 'device-1',
              }
            ]
          });
        }
      });

      let _eventManager = new EventManager();
      let lastevalkey = null;
      let deviceId = 'some text';
      let newEvent = event;
      newEvent['deviceName'] = 'device-1';

      _eventManager
        .getAlerts(ticket, lastevalkey, deviceId)
        .then(data => {
          assert.deepEqual(data, {Items: [newEvent], deviceId: 'some text'});
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when get setting returns empty', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {});
      });

      let _eventManager = new EventManager();
      let lastevalkey = null;
      let deviceId = 'some text';

      _eventManager
        .getAlerts(ticket, lastevalkey, deviceId)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingUserConfig',
            message: `No user settings found.`,
          });
          done();
        });
    });

    it('should return error information when get setting fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback('error', null);
      });

      let _eventManager = new EventManager();
      let lastevalkey = null;
      let deviceId = 'some text';

      _eventManager
        .getAlerts(ticket, lastevalkey, deviceId)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'SettingsRetrieveFailure',
            message: `Error occurred while attempting to retrieve settings information.`
          });
          done();
        });
    });

    it('should return error information when retrieving alerts fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          Item: {
            setting: {
              alertLevel: [
                'error',
                'warning',
              ]
            }
          }
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback('error', null);
      });

      let _eventManager = new EventManager();
      let lastevalkey = null;
      let deviceId = 'some text';

      _eventManager
        .getAlerts(ticket, lastevalkey, deviceId)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'AlertQueryFailure',
             message: `Error occurred while attempting to retrieve event alerts.`
          });
          done();
        });
    });
  });

  describe("#getAlertsCount", function() {
    beforeEach(function() {});

    afterEach(function() {
      AWS.restore('DynamoDB.DocumentClient');
    });

    const alertLevel = {
      setting: {
        alertLevel: [
          'error',
          'warning',
        ]
      },
    };

    it('should return count of alerts successfully', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          Item: alertLevel,
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback(null, {
          Items: [event],
          Count: 1,
        });
      });

      let _eventManager = new EventManager();
      _eventManager
        .getAlertsCount(ticket)
        .then(data => {
          assert.deepEqual(data, {alertsCount: 1});
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return count of alerts successfully with more data', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          Item: alertLevel,
        });
      });

      let _calls = 0;
      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        if (_calls === 0) {
          _calls++;
          callback(null, {
            Items: [event],
            Count: 1,
            LastEvaluatedKey: {key: 'key'},
          });
        } else {
          callback(null, {
            Items: [event],
            Count: 1,
          });
        }
      });

      let _eventManager = new EventManager();
      _eventManager
        .getAlertsCount(ticket)
        .then(data => {
          assert.deepEqual(data, {alertsCount: 2});
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return error information when get setting returns empty', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {});
      });

      let _eventManager = new EventManager();
      _eventManager
        .getAlertsCount(ticket)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 400,
            error: 'MissingUserConfig',
            message: `No user settings found.`,
          });
          done();
        });
    });

    it('should return error information when get setting fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback('error', null);
      });

      let _eventManager = new EventManager();
      _eventManager
        .getAlertsCount(ticket)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'SettingsRetrieveFailure',
            message: `Error occurred while attempting to retrieve settings information.`
          });
          done();
        });
    });

    it('should return error information when retrieving alerts fails', function(done) {
      AWS.mock('DynamoDB.DocumentClient', 'get', function(_params, callback) {
        callback(null, {
          Item: alertLevel,
        });
      });

      AWS.mock('DynamoDB.DocumentClient', 'query', function(_params, callback) {
        callback('error', null);
      });

      let _eventManager = new EventManager();
      _eventManager
        .getAlertsCount(ticket)
        .then(_data => {
          done('invalid failure for negative test');
        })
        .catch(err => {
          expect(err).to.deep.equal({
            code: 500,
            error: 'AlertRetrieveFailure',
            message: `Error occurred while attempting to get the count of event alerts.`,
          });
          done();
        });
    });
  });
});
