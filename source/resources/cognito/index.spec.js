'use strict'

const expect = require('chai').expect;
const AWS = require('aws-sdk-mock');

let event = {
  version: '1',
  region: 'REGION',
  userPoolId: 'USER_POOL_ID',
  userName: 'USER_NAME',
  callerContext: {
      awsSdkVersion: 'aws-sdk-unknown-unknown',
      clientId: 'CLIENT_ID'
  },
  triggerSource: 'PostConfirmation_ConfirmSignUp',
  request: {
      userAttributes: {
          sub: 'SAMPLE_COGNITO_USER_ID',
          'cognito:user_status': 'CONFIRMED',
          email_verified: 'true',
          'cognito:email_alias': 'E_MAIL_ADDRESS',
          phone_number_verified: 'false',
          phone_number: 'PHONE_NUMBER',
          email: 'E_MAIL_ADDRESS'
      }
  },
  response: {}
};

let _module = require('./index.js');

describe('Index', () => {
  /** 
   * The test throws error due to the restriction of aws-sdk-mock.
   * Please refer to https://www.npmjs.com/package/aws-sdk-mock.
   * To test below, you need to put resource declarations in the handler function.
  */
  // afterEach(() => {
  //   AWS.restore('DynamoDB.DocumentClient');
  // });

  // it('should return success when ddb put successful', function(done) {
  //   AWS.mock('DynamoDB.DocumentClient', 'put', Promise.resolve('success'));

  //   _module.handler(event)
  //     .then(data => {
  //       expect(data).to.deep.equal(event);
  //       done();
  //     })
  //     .catch(err => {
  //       done(err);
  //     });
  // });

  // it('should return error information when ddb put fails', function(done) {
  //   AWS.mock('DynamoDB.DocumentClient', 'put', Promise.reject('error'));

  //   _module.handler(event)
  //     .then(_data => {
  //       done('invalid failure for negative test');
  //     })
  //     .catch(err => {
  //       expect(err).to.equal('error');
  //       done();
  //     });
  // });
});
