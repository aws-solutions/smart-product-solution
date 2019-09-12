/*********************************************************************************************************************
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/**
 * @author Solution Builders
 */

'use strict';

/**
 * Lib
 */
const Logger = require('logger');
const Auth = require('authorizer');
const Event = require('./event.js');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const app = express();
const router = express.Router();

// declare a new express app
router.use(cors());
router.use((req, res, next) => {
  bodyParser.json()(req, res, err => {
    if (err) {
      return res.status(400).json({
        code: 400,
        error: 'BadRequest',
        message: err.message
      });
    }
    next();
  });
});
router.use(bodyParser.urlencoded({extended: true}));
router.use(awsServerlessExpressMiddleware.eventContext());

const claimTicketHandler = async (req, res, next) => {
  try {
    const ticket = await Auth.getUserClaimTicket(req.header('Authorization'));
    req.ticket = ticket;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({error: 'AccessDeniedException', message: err.message});
  }
};

// Updates an event
const updateEvent = async (req, res) => {
  const {body, ticket} = req;
  const {deviceId} = req.params;
  let _event = new Event();
  Logger.log(
    Logger.levels.INFO,
    `Attempting to update event information for a device ${deviceId}`
  );

  try {
    const result = await _event.updateEvent(ticket, deviceId, body);
    res.json(result);
  } catch (err) {
    Logger.log(Logger.levels.INFO, err);

    let status = err.code;
    return res.status(status).json(err);
  }
};

// Gets an event
const getEvent = async (req, res) => {
  const {ticket} = req;
  const {deviceId, eventId} = req.params;
  let _event = new Event();
  Logger.log(
    Logger.levels.INFO,
    `Attempting to retrieve event information for a device ${deviceId}`
  );

  try {
    const result = await _event.getEvent(ticket, deviceId, eventId);
    res.json(result);
  } catch (err) {
    Logger.log(Logger.levels.INFO, err);

    let status = err.code;
    return res.status(status).json(err);
  }
};

// Gets the list of events
const listEvents = async (req, res) => {
  const {ticket} = req;
  const {deviceId} = req.params;
  const {lastevalkey, eventType} = req.query;
  let _event = new Event();
  Logger.log(
    Logger.levels.INFO,
    `Attempting to list events for a device ${deviceId}`
  );

  try {
    const result = await _event.getEvents(ticket, lastevalkey, deviceId, eventType);
    res.json(result);
  } catch (err) {
    Logger.log(Logger.levels.INFO, err);

    let status = err.code;
    return res.status(status).json(err);
  }
};

// Gets the list of event history
const listEventHistory = async (req, res) => {
  const {ticket} = req;
  const {lastevalkey, deviceId, eventType} = req.query;
  let _event = new Event();
  Logger.log(
    Logger.levels.INFO,
    `Attempting to list whole event history`
  );

  try {
    const result = await _event.getEventHistory(ticket, lastevalkey, deviceId, eventType);
    res.json(result);
  } catch (err) {
    Logger.log(Logger.levels.INFO, err);

    let status = err.code;
    return res.status(status).json(err);
  }
}

// Gets the list of alerts
const listAlerts = async (req, res) => {
  const {ticket} = req;
  const {lastevalkey, deviceId} = req.query;
  let _event = new Event();
  Logger.log(
    Logger.levels.INFO,
    `Attempting to list whole alerts`
  );

  try {
    const result = await _event.getAlerts(ticket, lastevalkey, deviceId);
    res.json(result);
  } catch (err) {
    Logger.log(Logger.levels.INFO, err);

    let status = err.code;
    return res.status(status).json(err);
  }
}

// Gets the count of alerts
const getAlertsCount = async (req, res) => {
  const {ticket} = req;
  let _event = new Event();
  Logger.log(
    Logger.levels.INFO,
    `Attempting to get the count of alerts`
  );

  try {
    const result = await _event.getAlertsCount(ticket);
    res.json(result);
  } catch (err) {
    Logger.log(Logger.levels.INFO, err);

    let status = err.code;
    return res.status(status).json(err);
  }
}

/****************************
 * Event methods *
 ****************************/

router.get('/devices/events', claimTicketHandler, listEventHistory);

router.get('/devices/alerts', claimTicketHandler, listAlerts);

router.get('/devices/alerts/count', claimTicketHandler, getAlertsCount);

router.get('/devices/:deviceId/events', claimTicketHandler, listEvents);

router.get('/devices/:deviceId/events/:eventId', claimTicketHandler, getEvent);

router.put('/devices/:deviceId/events/:eventId', claimTicketHandler, updateEvent);

app.use('/', router);

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app;
