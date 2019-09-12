'use strict';

const expect = require('chai').expect;

const lib = require('./index.js');
let event = {};

const successData = [
  {
    createdAt: '2019-05-01T12:43:07-07:00',
    deviceId: '9fd6fd62-0b10-4b5c-a7a1-5995c81db07e',
    actualTemperature: 45.75,
    targetTemperature: 70,
    sentAt: '2019-05-01T12:43:07-07:00',
    timestamp: 1556739787113,
    actualTemperatureC: 7.64,
    targetTemperatureC: 21.11,
    sentAtUtc: '2019-05-01T19:43:07.113Z',
    createdAtUtc: '2019-05-01T19:43:07.113Z',
  },
  {
    createdAt: '2019-05-01T12:43:17-07:00',
    deviceId: '9fd6fd62-0b10-4b5c-a7a1-5995c81db07e',
    actualTemperature: 46.5,
    targetTemperature: 70,
    sentAt: '2019-05-01T12:43:17-07:00',
    timestamp: 1556739797117,
    actualTemperatureC: 8.06,
    targetTemperatureC: 21.11,
    sentAtUtc: '2019-05-01T19:43:17.117Z',
    createdAtUtc: '2019-05-01T19:43:17.117Z',
  },
  {
    createdAt: '2019-05-01T12:43:27-07:00',
    deviceId: '9fd6fd62-0b10-4b5c-a7a1-5995c81db07e',
    actualTemperature: 47.25,
    targetTemperature: 70,
    sentAt: '2019-05-01T12:43:27-07:00',
    timestamp: 1556739807117,
    actualTemperatureC: 8.47,
    targetTemperatureC: 21.11,
    sentAtUtc: '2019-05-01T19:43:27.117Z',
    createdAtUtc: '2019-05-01T19:43:27.117Z',
  },
];

describe('Index', () => {
  beforeEach(() => {});

  it('should return event messages with Celsius temperature and UTC time if keys exist', (done) => {
    event = [
      {
        createdAt: '2019-05-01T12:43:07-07:00',
        deviceId: '9fd6fd62-0b10-4b5c-a7a1-5995c81db07e',
        actualTemperature: 45.75,
        targetTemperature: 70,
        sentAt: '2019-05-01T12:43:07-07:00',
        timestamp: 1556739787113,
      },
      {
        createdAt: '2019-05-01T12:43:17-07:00',
        deviceId: '9fd6fd62-0b10-4b5c-a7a1-5995c81db07e',
        actualTemperature: 46.5,
        targetTemperature: 70,
        sentAt: '2019-05-01T12:43:17-07:00',
        timestamp: 1556739797117,
      },
      {
        createdAt: '2019-05-01T12:43:27-07:00',
        deviceId: '9fd6fd62-0b10-4b5c-a7a1-5995c81db07e',
        actualTemperature: 47.25,
        targetTemperature: 70,
        sentAt: '2019-05-01T12:43:27-07:00',
        timestamp: 1556739807117,
      },
    ];

    lib
      .process(event)
      .then(data => {
        expect(data).to.deep.equal(successData);
        done();
      })
      .catch(err => {
        done(err);
      });
  });
});
