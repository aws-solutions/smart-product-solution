import React, { Component } from "react";
import { API } from "aws-amplify";
import {
  Tabs,
  Tab,
  Button,
  Alert,
  ProgressBar,
  Grid,
  Row,
  Col,
  Table,
  Label,
  FormGroup,
  FormControl,
  ControlLabel,
  ListGroup,
  ListGroupItem,
  HelpBlock,
  Modal
} from 'react-bootstrap';

import { Card } from "components/Card/Card.jsx";

class DeviceDetail extends Component {
  constructor(props) {
    super(props);

    // General
    this.goDeviceRegistration = this.goDeviceRegistration.bind(this);

    // Commands
    this.handleCommandStatusChange = this.handleCommandStatusChange.bind(this);
    this.handleCommandSubmit = this.handleCommandSubmit.bind(this);
    this.handleCommandDetailShow = this.handleCommandDetailShow.bind(this);
    this.handleCommandDetailClose = this.handleCommandDetailClose.bind(this);
    this.handleCreateCommand = this.handleCreateCommand.bind(this);
    this.handleCommandClose = this.handleCommandClose.bind(this);
    this.handleTargetTemperatureChange = this.handleTargetTemperatureChange.bind(this);

    // Logs
    this.handleEventLogsSubmit = this.handleEventLogsSubmit.bind(this);
    this.handleEventTypeChange = this.handleEventTypeChange.bind(this);

    // Common
    this.goBack = this.goBack.bind(this);
    this.handleTabSelect = this.handleTabSelect.bind(this);

    // Sets up initial state
    this.state = {
      // common
      statusInitial: true,
      page: 'general',

      // general
      loadingDevice: false,
      loadingStatus: false,
      device: false,
      deviceStatus: false,
      deviceError: false,
      statusError: false,
      title: '',
      isMinimized: false,

      // commands
      actualTemperature: '',
      targetTemperature: '',
      updatedTargetTemperature: '',
      targetTemperatureState: null,
      setCommand: '',
      setCommandValue: '',
      powerStatus: '',
      commandShow: false,
      commandMessage: '',
      showCommandHelpBlock: false,
      commadError: false,
      commandHasMore: true,
      loadingCommand: false,
      creatingCommand: false,
      commandDetail: false,
      commandDetailError: false,
      commandDetailLoading: false,
      commandLastevalkey: null,
      commands: [],
      commandDetailShow: false,
      commandInitial: true,
      commandStatus: '',
      updatedCommandStatus: '',

      // logs
      eventLogsError: false,
      loadingEventLogs: false,
      eventLogsHasMore: true,
      events: [],
      eventLogsLastevalkey: null,
      eventType: '',
      updatedEventType: '',
      eventDetailShow: false,
      eventDetail: false,
      eventDetailError: false,
      eventDetailLoading: false,
      eventLogsInitial: true,
    };
  }

  componentDidMount() {
    this.handleResize();
    this.getDevice();
    this.getDeviceStatus();

    this.timer = setInterval(async () => {
      await this.getDeviceStatus();
    }, 60000); // Gets status every 1 minute

    window.addEventListener('scroll', this.handleScroll);
    window.addEventListener('resize', this.handleResize);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);
  }

  // Handles tab select
  handleTabSelect(eventKey) {
    if (eventKey === 'commands' && this.state.commandInitial) {
      this.setState({ commandInitial: false });
      this.getCommands();
    } else if (eventKey === 'logs' && this.state.eventLogsInitial) {
      this.setState({ eventLogsInitial: false });
      this.getEventLogs();
    }

    this.setState({ page: eventKey });
  }

  // Handles scroll down to load more
  handleScroll = (_event) => {
    let page = this.state.page;
    if (page === 'commands') {
      const {commandError, loadingCommand, commandHasMore} = this.state;
      if (commandError || loadingCommand || !commandHasMore) return;

      // Checks that the page has scrolled to the bottom
      if (this.props.isScrollBottom() && !this.state.commandInitial) {
        this.getCommands();
      }
    } else if (page === 'logs') {
      const {eventLogsError, loadingEventLogs, eventLogsHasMore} = this.state;
      if (eventLogsError || loadingEventLogs || !eventLogsHasMore) return;

      // Checks that the page has scrolled to the bottom
      if (this.props.isScrollBottom() && !this.state.eventLogsInitial) {
        this.getEventLogs();
      }
    }
  };

  // Handles window resize
  handleResize = (_event) => {
    if (window.innerWidth < 993) {
      this.setState({ isMinimized: true, });
    } else {
      this.setState({ isMinimized: false, });
    }
  };

  // Goes to the device registration instruction
  goDeviceRegistration = (deviceId) => {
    this.props.history.push({
      pathname: '/devices/registration',
      state: { deviceId: deviceId }
    });
  }

  // Handles command status change
  handleCommandStatusChange = (event) => {
    this.setState({ updatedCommandStatus: event.target.value});
  }

  // Handles command submit
  handleCommandSubmit = async (event) => {
    event.preventDefault();
    this.setState({
      commands: [],
      commandLastevalkey: null,
      commandError: false,
      commandStatus: this.state.updatedCommandStatus,
    });
    this.getCommands();
  }

  // Handles command detail
  handleCommandDetailShow = async (deviceId, commandId) => {
    this.setState({
      commandDetailError: false,
      commandDetail: false,
      commandDetailLoading: true
    });
    let token = await this.props.getToken();
    let apiName = 'smart-product-api';
    let path = `devices/${deviceId}/commands/${commandId}`;
    let params = {
      headers: {
        'Authorization': token,
      },
      response: true
    };

    API.get(apiName, path, params)
      .then(response => {
        this.setState({ commandDetail: response.data });
      })
      .catch(error => {
        let message = error.response;
        if (message === undefined) {
          message = error.message;
        } else {
          message = error.response.data.message;
        }

        this.setState({ commandDetailError: message });
      })
      .finally(() => {
        this.setState({ commandDetailLoading: false });
      })
      this.setState({ commandDetailShow: true });
  }

  // Handles command detail close
  handleCommandDetailClose = () => {
    this.setState({ commandDetailShow: false });
  }

  // Handles create command
  handleCreateCommand = (mode) => {
    let pass = true;
    let message = '';
    let setCommand = '';
    let setCommandValue = '';

    switch (mode) {
      case 'HEAT': {
        message = 'turn on the heat';
        setCommand = 'set-mode';
        setCommandValue = 'HEAT';
        break;
      }
      case 'AC': {
        message = 'turn on the AC';
        setCommand = 'set-mode';
        setCommandValue = 'AC';
        break;
      }
      case 'OFF': {
        message = 'turn off the device';
        setCommand = 'set-mode';
        setCommandValue = 'OFF';
        break;
      }
      case 'TEMPERATURE': {
        if (!this.targetTemperatureValidate()) {
          pass = false;
          message = 'Invalid target temperature. (50 <= temperature <= 110)';
        } else if (this.state.targetTemperature === this.state.updatedTargetTemperature) {
          pass = false;
          message = 'Target temperature has not been changed.';
        } else {
          message = `set the temperature to ${this.state.updatedTargetTemperature}`;
          setCommand = 'set-temp';
          setCommandValue = this.state.updatedTargetTemperature;
        }
        break;
      }
      default: {
        break;
      }
    }

    if (pass) {
      this.setState({
        setCommand: setCommand,
        setCommandValue: setCommandValue,
        commandShow: true,
        message: message,
      }, () => {});
    } else {
      this.props.handleNotification(message, 'error', 'pe-7s-check', 5);
    }
  }

  // Handles command pop up close
  handleCommandClose = () => {
    this.setState({ commandShow: false });
  }

  // Handles target temperature change
  handleTargetTemperatureChange = (event) => {
    this.setState({ updatedTargetTemperature: event.target.value }, () => {
      this.targetTemperatureValidate();
    });
  }

  // Handles event logs submit
  handleEventLogsSubmit = async (event) => {
    event.preventDefault();
    this.setState({
      events: [],
      eventLogsLastevalkey: null,
      eventLogsError: false,
      eventType: this.state.updatedEventType,
    });
    this.getEventLogs();
  }

  // Handles input changes
  handleEventTypeChange = (event) => {
    this.setState({ updatedEventType: event.target.value});
  }

  // Handles event detail
  handleEventDetailShow = async (deviceId, eventId) => {
    this.setState({
      eventDetailError: false,
      eventDetail: false,
      eventDetailLoading: true
    });
    let token = await this.props.getToken();
    let apiName = 'smart-product-api';
    let path = `devices/${deviceId}/events/${eventId}`;
    let params = {
      headers: {
        'Authorization': token,
      },
      response: true
    };

    API.get(apiName, path, params)
      .then(response => {
        this.setState({ eventDetail: response.data });
        if (!response.data.ack) {
          this.updateEvent(deviceId, eventId);
        }
      })
      .catch(error => {
        let message = error.response;
        if (message === undefined) {
          message = error.message;
        } else {
          message = error.response.data.message;
        }

        this.setState({ eventDetailError: message });
      })
      .finally(() => {
        this.setState({ eventDetailLoading: false });
      })
      this.setState({ eventDetailShow: true });
  }

  // Handles detail close
  handleEventDetailClose = () => {
    this.setState({ eventDetailShow: false });
  }

  // Gets device information
  getDevice = async () => {
    this.setState({ loadingDevice: true });
    const { deviceId } = this.props.match.params;
    let token = await this.props.getToken();
    let apiName = 'smart-product-api';
    let path = `devices/${deviceId}`;
    let params = {
      headers: {
        'Authorization': token,
      },
      response: true,
    };

    API.get(apiName, path, params)
      .then(response => {
        let device = response.data;
        this.setState({
          device: device,
          title: `${device.deviceName}`,
        });
      })
      .catch(error => {
        let message = error.response;
        if (message === undefined) {
          message = error.message;
        } else {
          message = error.response.data.message;
        }

        this.setState({ deviceError: message })
      })
      .finally(() => {
        this.setState({ loadingDevice: false });
      });
  }

  // Gets device status
  getDeviceStatus = async () => {
    if (this.state.statusInitial) {
      this.setState({ loadingStatus: true });
    }

    const { deviceId } = this.props.match.params;
    let token = await this.props.getToken();
    let apiName = 'smart-product-api';
    let path = `devices/${deviceId}/status`;
    let params = {
      headers: {
        'Authorization': token,
      },
      response: true,
    };

    API.get(apiName, path, params)
      .then(response => {
        let deviceStatus = '';
        if (
          Object.keys(response.data).length === 0
          || response.data.state.reported === undefined
          || !response.data.connected
        ) {
          deviceStatus = {
            state: {},
            connected: false,
          }
          this.setState({
            actualTemperature: 'N/A',
            targetTemperature: 'N/A',
            powerStatus: 'Disconnected',

          }, () => {});
        } else {
          deviceStatus = response.data;
          let reported = response.data.state.reported;
          if (this.state.statusInitial) {
            this.setState({
              actualTemperature: reported.actualTemperature,
              targetTemperature: reported.targetTemperature,
              updatedTargetTemperature: reported.targetTemperature,
              powerStatus: reported.powerStatus,
            });
          } else {
            this.setState({
              actualTemperature: reported.actualTemperature,
            });
          }
        }
        this.setState({ deviceStatus: deviceStatus });
      })
      .catch(error => {
        let message = error.response;
        if (message !== undefined) {
          if (message.data.error === 'MissingRegistration') {
            // If getting the device status has an issue due to MissingRegistration, clear the timer.
            clearInterval(this.timer);
          } else {
            this.props.handleNotification('Failed to get device status', 'error', 'pe-7s-check', 5);
          }
        }
        
        this.setState({
          actualTemperature: 'N/A',
          targetTemperature: 'N/A',
          powerStatus: 'FAIL',
        });
      })
      .finally(() => {
        if (this.state.statusInitial) {
          this.setState({
            loadingStatus: false,
            statusInitial: false,
          });
        }
      });
  }

  // Gets device commands
  getCommands = async () => {
    this.setState({ loadingCommand: true});
    const { deviceId } = this.props.match.params;
    let token = await this.props.getToken();
    let apiName = 'smart-product-api';
    let path = `devices/${deviceId}/commands`;
    let params = {
      headers: {
        'Authorization': token,
      },
      response: true,
      queryStringParameters: {
        lastevalkey: JSON.stringify(this.state.commandLastevalkey),
        commandStatus: this.state.commandStatus,
      }
    };

    API.get(apiName, path, params)
      .then(response => {
        /**
         * If response has no data and LastEvaluatedKey is null, there is no more data.
         * Otherwise, show the data.
         */
        if (response.data.Items.length === 0
          && (response.data.LastEvaluatedKey === null
            || response.data.LastEvaluatedKey === undefined)) {
          this.setState({
            commandHasMore: false,
            loadingCommand: false
          });
        } else {
          this.setState({
            commandHasMore: response.data.LastEvaluatedKey !== undefined,
            loadingCommand: false,
            commandLastevalkey: response.data.LastEvaluatedKey,
            commandStatus: response.data.commandStatus,
            commands: [
              ...this.state.commands,
              ...response.data.Items
            ]
          });
        }
      }).catch(error => {
        let message = error.response;
        if (message === undefined) {
          message = error.message;
        } else {
          message = error.response.data.message;
        }

        this.setState({
          commandError: message,
          loadingCommand: false
        });
      });
  };

  // Validates target temperature
  targetTemperatureValidate = () => {
    let temperature = this.state.updatedTargetTemperature;
    let pass = !isNaN(temperature) && temperature !== ''
      && temperature >= 50 && temperature <= 110;

    if (!pass) {
      this.setState({
        showHelpBlock: true,
        targetTemperatureState: 'error',
      });
    } else {
      this.setState({
        showHelpBlock: false,
        targetTemperatureState: null,
      });
    }

    return pass;
  }

  // Creates a command
  createCommand = async () => {
    if (!this.state.creatingCommand) {
      this.setState({ creatingCommand: true });
      const { deviceId } = this.props.match.params;
      let {targetTemperature, setCommand, setCommandValue, powerStatus} = this.state;

      if (setCommand === 'set-temp') {
        targetTemperature = this.state.updatedTargetTemperature;
      }

      if (setCommand === 'set-mode') {
        powerStatus = setCommandValue;
      }

      let body = {
        deviceId: deviceId,
        commandDetails: {
          command: this.state.setCommand,
          value: this.state.setCommandValue,
        },
        shadowDetails: {
          powerStatus: powerStatus,
          actualTemperature: this.state.actualTemperature,
          targetTemperature: targetTemperature,
        }
      }

      let token = await this.props.getToken();
      let apiName = 'smart-product-api';
      let path = `devices/${deviceId}/commands`;
      let params = {
        headers: {
          'Authorization': token,
        },
        body: body,
        response: true,
      };

      API.post(apiName, path, params)
        .then(response => {
          this.setState({
            powerStatus: powerStatus,
            targetTemperature: targetTemperature,
          }, () => {});
          this.props.handleNotification('Success to execute the command', 'success', 'pe-7s-check', 5);
        })
        .catch(error => {
          this.props.handleNotification('Failed to execute the command', 'error', 'pe-7s-check', 5);
        })
        .finally(() => {
          this.setState({
            commandShow: false,
            creatingCommand: false,
            commands: [],
            commandLastevalkey: null,
            commandError: false,
          });
          this.getDeviceStatus();
          this.getCommands();
        });
    } else {
      this.props.handleNotification('Still in progress to execute the command', 'error', 'pe-7s-check', 5);
    }
  }

  // Gets device event log
  getEventLogs = async () => {
    this.setState({ loadingEventLogs: true});
    const { deviceId } = this.props.match.params;
    let token = await this.props.getToken();
    let apiName = 'smart-product-api';
    let path = `devices/${deviceId}/events`;
    let params = {
      headers: {
        'Authorization': token,
      },
      response: true,
      queryStringParameters: {
        lastevalkey: JSON.stringify(this.state.eventLogsLastevalkey),
        eventType: this.state.eventType
      }
    };

    API.get(apiName, path, params)
      .then(response => {
        /**
         * If response has no data and LastEvaluatedKey is null, there is no more data.
         * Otherwise, show the data.
         */
        if (response.data.Items.length === 0
          && (response.data.LastEvaluatedKey === null
            || response.data.LastEvaluatedKey === undefined)) {
          this.setState({
            eventLogsHasMore: false,
            loadingEventLogs: false
          });
        } else {
          this.setState({
            eventLogsHasMore: response.data.LastEvaluatedKey !== undefined,
            loadingEventLogs: false,
            eventLogsLastevalkey: response.data.LastEvaluatedKey,
            eventType: response.data.eventType,
            events: [
              ...this.state.events,
              ...response.data.Items
            ]
          });
        }
      }).catch(error => {
        let message = error.response;
        if (message === undefined) {
          message = error.message;
        } else {
          message = error.response.data.message;
        }

        this.setState({
          eventLogsError: message,
          loadingEventLogs: false
        });
      });
  }

  // Updates the event
  updateEvent = async (deviceId, eventId) => {
    let token = await this.props.getToken();
    let apiName = 'smart-product-api';
    let path = `devices/${deviceId}/events/${eventId}`;
    let params = {
      headers: {
        'Authorization': token,
      },
      body: {
        id: eventId,
        ack: true,
        suppress: true,
      },
    };

    API.put(apiName, path, params)
      .catch(error => {
        let message = error.response;
        if (message === undefined) {
          message = error.message;
        } else {
          message = error.response.data.message;
        }

        this.setState({ eventDetailError: message });
      });
  }

  // Goes back to the main landing page
  goBack() {
    this.props.history.push('/devices');
  }

  render() {
    const { loadingDevice, loadingStatus, device, deviceStatus, 
      loadingCommand, commandDetailLoading, creatingCommand, commands, commandStatus, powerStatus, commandDetail, 
      loadingEventLogs, eventDetailLoading, events, eventType, eventDetail,
      commandHasMore, eventLogsHasMore, showCommandHelpBlock,
      deviceError, statusError, commandError, commandDetailError, eventLogsError, eventDetailError,
      title, message, isMinimized, } = this.state;
    const commandThArray = ['Command Detail', 'Command Status', 'Created At', 'Updated At'];
    const disabledConditions = ['FAIL', 'Disconnected'];
    const eventThArray = ['Event Message', 'Event Type', 'Created At'];

    return(
      <div className="content">
        <Grid fluid>
        { !loadingDevice &&
          <div key="main-content">
            <Row>
              <Col md={12}>
                  <div key="device-name">
                    <h4>
                      Device Information <br />
                      <Label bsStyle={device.status === 'deleted' ? "danger" : "primary"}>{title}</Label>
                      <Button bsSize="small" className="btn-fill pull-right" onClick={this.goBack}>&lt;&lt;</Button>
                    </h4>
                  </div>
              </Col>
            </Row>
            { device &&
            <Row>
              <Col md={12}>
                <Tabs defaultActiveKey={"general"} animation={false} id="device-detail-tab" 
                  onSelect={k => this.handleTabSelect(k)} className={ isMinimized ? "mobile_tabs" : "" }>
{/*
  General Tab
*/}
                  <Tab eventKey={"general"} title="General">
                    <Row>
                      <Col md={6}>
                        { device && deviceStatus &&
                        <Card title="Device Detail"
                          content={
                            <div>
                            <Table striped bordered>
                              <tbody>
                                <tr>
                                  <td>Serial Number</td>
                                  <td>{device.deviceId}</td>
                                </tr>
                                <tr>
                                  <td>Created At</td>
                                  <td>{device.createdAt}</td>
                                </tr>
                                <tr>
                                  <td>Activated At</td>
                                  <td>{device.activatedAt}</td>
                                </tr>
                                <tr>
                                  <td>Updated At</td>
                                  <td>{device.updatedAt}</td>
                                </tr>
                                <tr>
                                  <td>Status</td>
                                  <td>
                                    <Label bsStyle={device.status === 'deleted' ? "danger" : "info"}>{device.status}</Label>
                                    { device.status === 'pending' &&
                                    <div>
                                      <br />
                                      <Button className="btn-fill" bsSize="xsmall" onClick={() => this.goDeviceRegistration(device.deviceId)}>Back to Registration</Button>
                                    </div>
                                    }
                                  </td>
                                </tr>
                              </tbody>
                            </Table>
                            <Table striped bordered>
                              <tbody>
                                <tr>
                                  <td colSpan="2"><b>Details</b></td>
                                </tr>
                                { device.details &&
                                  Object.keys(device.details).map(key => {
                                    return(
                                      <tr key={key}>
                                        <td>{key}</td>
                                        <td>{device.details[key]}</td>
                                      </tr>
                                    )
                                  })
                                }
                                { (!device.details || 
                                  Object.keys(device.details).length === 0) &&
                                  <tr>
                                    <td>Device Details</td>
                                    <td>Not found</td>
                                  </tr>
                                }
                              </tbody>
                            </Table>
                            </div>
                          }
                        />
                        }
                      </Col>
                      <Col md={6}>
                        { device && deviceStatus &&
                        <Card
                          title="Device Status"
                          content={
                            <div>
                            <Table striped bordered>
                              <tbody>
                                <tr>
                                  <td key="connectivity">Connectivitiy</td>
                                  <td>{deviceStatus.connected ? "Connected" : "Disconnected"}</td>
                                </tr>
                              </tbody>
                            </Table>
                            <Table striped bordered>
                              <tbody>
                                <tr>
                                  <td colSpan="2"><b>State</b></td>
                                </tr>
                                { Object.keys(deviceStatus.state).length !== 0 &&
                                  Object.keys(deviceStatus.state.reported).map(key => {
                                    return(
                                      <tr key={key}>
                                        <td>{key}</td>
                                        <td>{deviceStatus.state.reported[key]}</td>
                                      </tr>
                                    )
                                  })
                                }
                                { Object.keys(deviceStatus.state).length === 0 &&
                                  <tr>
                                    <td>State</td>
                                    <td>Not found</td>
                                  </tr>
                                }
                              </tbody>
                            </Table>
                            </div>
                          }
                        />
                        }
                      </Col>
                    </Row>
                  </Tab>
{/*
  Commands Tab
*/}
                  <Tab eventKey={"commands"} title="Commands">
                    <Row>
                      <Col md={12}>
                        <Card
                          content={
                            <div>
                              <p>Issue Remote Command</p>
                              <ListGroup>
                                <ListGroupItem>
                                  <h3>Mode</h3>
                                  <Col md={12}>
                                    <FormGroup>
                                      <ControlLabel>Current Mode</ControlLabel>
                                      <FormControl type="text" defaultValue={this.state.powerStatus} disabled />
                                    </FormGroup>
                                  </Col>
                                  <div>
                                    <Button className="btn-fill pull-right" bsSize="small" id="OFF"
                                      onClick={() => this.handleCreateCommand('OFF')}
                                      disabled={powerStatus === 'OFF' || disabledConditions.indexOf(powerStatus) > -1}
                                      active={disabledConditions.indexOf(powerStatus) < 0}>OFF</Button>
                                    <span className="pull-right">&nbsp;</span>
                                    <Button bsStyle="primary" bsSize="small" id="AC" className="btn-fill pull-right"
                                      onClick={() => this.handleCreateCommand('AC')}
                                      disabled={powerStatus === 'AC' || disabledConditions.indexOf(powerStatus) > -1}
                                      active={disabledConditions.indexOf(powerStatus) < 0}>AC</Button>
                                    <span className="pull-right">&nbsp;</span>
                                    <Button bsStyle="danger" bsSize="small" id="HEAT" className="btn-fill pull-right"
                                      onClick={() => this.handleCreateCommand('HEAT')}
                                      disabled={powerStatus === 'HEAT' || disabledConditions.indexOf(powerStatus) > -1}
                                      active={disabledConditions.indexOf(powerStatus) < 0}>HEAT</Button>
                                    <div className="clearfix" />
                                  </div>
                                </ListGroupItem>
                                <ListGroupItem>
                                  <h3>Temperature (&#8457;)</h3>
                                  <Col md={6}>
                                    <FormGroup>
                                      <ControlLabel>Actual Temperature</ControlLabel>
                                      <FormControl type="number" defaultValue={this.state.actualTemperature} disabled />
                                    </FormGroup>
                                  </Col>
                                  <Col md={6}>
                                    <FormGroup validationState={this.state.targetTemperatureState}>
                                      <ControlLabel>Target Temperature</ControlLabel>
                                      <FormControl type="number" step="0.01" defaultValue={this.state.targetTemperature}
                                        disabled={disabledConditions.indexOf(powerStatus) > -1}
                                        onChange={this.handleTargetTemperatureChange} />
                                      { showCommandHelpBlock &&
                                        <HelpBlock>Invalid value</HelpBlock>
                                      }
                                    </FormGroup>
                                  </Col>
                                  <Button bsStyle="warning" bsSize="small" className="btn-fill pull-right"
                                    onClick={() => this.handleCreateCommand('TEMPERATURE')}
                                    disabled={disabledConditions.indexOf(powerStatus) > -1}
                                    active={disabledConditions.indexOf(powerStatus) < 0}>Set Temperature</Button>
                                  <div className="clearfix" />
                                </ListGroupItem>
                              </ListGroup>
                            </div>
                          }
                        />
                      </Col>
                    </Row>
                    <Row>
                      <Col md={12}>
                        <Card title="Command Log"
                          content={
                            <form onSubmit={this.handleCommandSubmit}>
                              <Col md={12}>
                                <FormGroup>
                                  <ControlLabel>Search by Command Status</ControlLabel>
                                  <FormControl componentClass="select" placeholder={commandStatus}
                                    onChange={this.handleCommandStatusChange} defaultValue={commandStatus}>
                                    <option value="">All</option>
                                    <option value="success">Success</option>
                                    <option value="failed">Failed</option>
                                    <option value="pending">Pending</option>
                                  </FormControl>
                                </FormGroup>
                              </Col>
                              <Button bsStyle="warning" bsSize="small" className="btn-fill pull-right" active type="submit">Search</Button>
                              <div className="clearfix" />
                            </form>
                          }
                        />
                      </Col>
                    </Row>
                    <Row>
                      <Col md={12}>
                        { !isMinimized &&
                        <Card
                          ctTableFullWidth
                          ctTableResponsive
                          content={
                            <Table striped hover>
                              <thead>
                                <tr>
                                  {
                                    commandThArray.map((prop, key) => {
                                      return (
                                        <th key={key}>{prop}</th>
                                      );
                                    })
                                  }
                                </tr>
                              </thead>
                              <tbody>
                                {/* If there is no command, showing no command found */}
                                { commands.length === 0 && !loadingCommand && !commandHasMore &&
                                  <tr>
                                    <td colSpan="4" align="center">No command found.</td>
                                  </tr>
                                }
                                { commands.map(command => {
                                    return (
                                      <tr key={command.commandId}>
                                        <td key={command.commandId}>
                                          <Button bsStyle="info" bsSize="small" className="btn-fill btn-round"
                                              onClick={() => this.handleCommandDetailShow(command.deviceId, command.commandId)}>
                                              {command.details.command} / {command.details.value}
                                          </Button>                                          
                                        </td>
                                        <td key={command.status+command.commandId}>
                                        { command.status === 'success' &&
                                          <Label bsStyle="info">{command.status}</Label>
                                        }
                                        { command.status === 'failed' &&
                                          <Label bsStyle="danger">{command.status}</Label>
                                        }
                                        { command.status === 'pending' &&
                                          <Label>{command.status}</Label>
                                        }
                                        </td>
                                        <td key={"createdAt"+command.commandId}>{command.createdAt}</td>
                                        <td key={"updatedAt"+command.commandId}>{command.updatedAt}</td>
                                      </tr>
                                    );
                                  })
                                }
                              </tbody>
                            </Table>
                          }
                        />
                        }
                        { isMinimized &&
                        <Card
                          ctTableFullWidth
                          ctTableResponsive
                          content={
                            <div className="custom_div">
                            {/* If there is no command, showing no command found */}
                            { commands.length === 0 && !loadingCommand && !commandHasMore &&
                              <div className="custom_list_item">
                                <span className="no_result">No command found.</span>
                              </div>
                            }
                            { commands.map(command => {
                                return (
                                  <div className="custom_list_item" key={command.commandId} 
                                    onClick={() => this.handleCommandDetailShow(command.deviceId, command.commandId)}>
                                    <span className="custom_mobile_date">
                                      <span className="mobile_date">C: {this.props.handleDateSize(command.createdAt)}</span>
                                    </span>                                    
                                    { command.status === 'success' &&
                                      <Label bsStyle="info" className="custom_mobile_message">{command.status}</Label>
                                    }
                                    { command.status === 'failed' &&
                                      <Label bsStyle="danger"className="custom_mobile_message">{command.status}</Label>
                                    }
                                    { command.status === 'pending' &&
                                      <Label className="custom_mobile_message">{command.status}</Label>
                                    }
                                    <span className="custom_mobile_date">
                                      <span className="mobile_date">U: {this.props.handleDateSize(command.updatedAt)}</span>
                                    </span>
                                    <span className="custom_mobile_title">
                                      <span className="mobile_title">{command.details.command} / {command.details.value}</span>
                                    </span>                                    
                                  </div>
                                );
                              })
                            }
                            </div>
                          }
                        />
                        }
                      </Col>
                    </Row>
                    { loadingCommand &&
                    <Row>
                      <Col md={12}>
                        <div>
                          <ProgressBar active now={50} />
                        </div>
                      </Col>
                    </Row>
                  }
                  { commandError &&
                    <Row>
                      <Col md={12}>
                        <Alert bsStyle="danger">
                          <span>{this.state.commandError}</span>
                        </Alert>
                      </Col>
                    </Row>
                  }
                  </Tab>
{/*
  Event Log Tab
*/}
                  <Tab eventKey={'logs'} title="Event Log">
                    <Row>
                      <Col md={12}>
                        <Card
                          title="Event Log"
                          content={
                            <form onSubmit={this.handleEventLogsSubmit}>
                              <Col md={12}>
                                <FormGroup>
                                  <ControlLabel>Search by Event Type</ControlLabel>
                                  <FormControl componentClass="select" placeholder={eventType}
                                    onChange={this.handleEventTypeChange} defaultValue={eventType}>
                                    <option value="">All</option>
                                    <option value="error">Error</option>
                                    <option value="warning">Warning</option>
                                    <option value="info">Info</option>
                                    <option value="diagnostic">Diagnostic</option>
                                  </FormControl>
                                </FormGroup>
                              </Col>
                              <Button bsStyle="warning" bsSize="small" className="btn-fill pull-right" active type="submit">Search</Button>
                              <div className="clearfix" />
                            </form>
                          }
                        />
                      </Col>
                    </Row>
                    <Row>
                      <Col md={12}>
                        { !isMinimized &&
                        <Card
                          ctTableFullWidth
                          ctTableResponsive
                          content={
                            <Table striped hover>
                              <thead>
                                <tr>
                                  {
                                    eventThArray.map((prop, key) => {
                                      return (
                                        <th key={key}>{prop}</th>
                                      );
                                    })
                                  }
                                </tr>
                              </thead>
                              <tbody>
                                {/* If there is no event, showing no event found */}
                                { events.length === 0 && !loadingEventLogs && !eventLogsHasMore &&
                                  <tr>
                                    <td colSpan="3" align="center">No event found.</td>
                                  </tr>
                                }
                                { events.map(event => {
                                    return (
                                      <tr key={event.id}>
                                        <td key={event.id} className="list_message_td">
                                        <Button bsStyle="info" bsSize="small" className="btn-fill btn-round custom_btn"
                                          onClick={() => this.handleEventDetailShow(event.deviceId, event.id)}>
                                            {event.message}
                                        </Button>
                                        </td>
                                        <td key={event.id+event.type} className="custom_event_type_td">
                                        {event.type === 'info' &&
                                          <Label bsStyle="info">{event.type}</Label>
                                        }
                                        {event.type === 'warning' &&
                                          <Label bsStyle="warning">{event.type}</Label>
                                        }
                                        {event.type === 'error' &&
                                          <Label bsStyle="danger">{event.type}</Label>
                                        }
                                        {event.type === 'diagnostic' &&
                                          <Label bsStyle="default">{event.type}</Label>
                                        }
                                        </td>
                                        <td key={event.id+event.createdAt} className="custom_date_td">
                                          {event.createdAt}
                                        </td>
                                      </tr>
                                    );
                                  })
                                }
                              </tbody>
                            </Table>
                          }
                        />
                        }
                        { isMinimized &&
                        <Card
                          ctTableFullWidth
                          ctTableResponsive
                          content={
                            <div className="custom_div">
                            {/* If there is no event, showing no event found */}
                            { events.length === 0 && !loadingEventLogs && !eventLogsHasMore &&
                              <div className="custom_list_item">
                                <span className="no_result">No event found.</span>
                              </div>
                            }
                            { events.map(event => {
                                return (
                                  <div className="custom_list_item" key={event.id} 
                                    onClick={() => this.handleEventDetailShow(event.deviceId, event.id)}>
                                    <span className="custom_mobile_date">
                                      <span className="mobile_date">{this.props.handleDateSize(event.createdAt)}</span>
                                    </span>
                                    <span className="custom_mobile_title">
                                      <span className="mobile_title">&nbsp;</span>
                                    </span>
                                    { event.type === 'info' &&
                                      <Label bsStyle="info" className="custom_mobile_message">
                                        <span className="mobile_message">{event.message}</span>
                                      </Label>
                                    }
                                    { event.type === 'warning' &&
                                      <Label bsStyle="warning" className="custom_mobile_message">
                                        <span className="mobile_message">{event.message}</span>
                                      </Label>
                                    }
                                    { event.type === 'error' &&
                                      <Label bsStyle="danger" className="custom_mobile_message">
                                        <span className="mobile_message">{event.message}</span>
                                      </Label>
                                    }
                                    { event.type === 'diagnostic' &&
                                      <Label bsStyle="default" className="custom_mobile_message">
                                        <span className="mobile_message">{event.message}</span>
                                      </Label>
                                    }
                                  </div>
                                );
                              })
                            }
                            </div>
                          }
                        />
                        }
                      </Col>
                    </Row>
                    { loadingEventLogs &&
                    <Row>
                      <Col md={12}>
                        <div>
                          <ProgressBar active now={50} />
                        </div>
                      </Col>
                    </Row>
                    }
                    { eventLogsError &&
                    <Row>
                      <Col md={12}>
                        <Alert bsStyle="danger">
                          <span>{this.state.eventLogsError}</span>
                        </Alert>
                      </Col>
                    </Row>
                    }
                  </Tab>
                </Tabs>
              </Col>
            </Row>
            }
          </div>
        }
        { (loadingDevice || loadingStatus) &&
          <Row>
            <Col md={12}>
              <div>
                <ProgressBar active now={50} />
              </div>
            </Col>
          </Row>
        }
        { deviceError &&
          <Row>
            <Col md={12}>
              <Alert bsStyle="danger">
                <span>Device Error: {this.state.deviceError}</span>
              </Alert>
            </Col>
          </Row>
        }
        { statusError &&
          <Row>
            <Col md={12}>
              <Alert bsStyle="danger">
                <span>Status Error: {this.state.statusError}</span>
              </Alert>
            </Col>
          </Row>
        }
        </Grid>
{/*
  Modal dialog
*/}
        <Modal show={this.state.commandDetailShow} onHide={this.handleCommandDetailClose}>
          <Modal.Header closeButton>
            <Modal.Title>Command Detail</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            { commandDetailLoading &&
              <div>
                <ProgressBar active now={50} />
              </div>
            }
            { commandDetailError &&
              <Alert bsStyle="danger">
                <span>{this.state.commandDetailError}</span>
              </Alert>
            }
            { commandDetail &&
              <Table striped bordered>
                <tbody>
                  <tr>
                    <td>Command ID</td>
                    <td>{commandDetail.commandId}</td>
                  </tr>
                  <tr>
                    <td>Device ID</td>
                    <td>{commandDetail.deviceId}</td>
                  </tr>
                  <tr>
                    <td>Command Status</td>
                    <td>{commandDetail.status}</td>
                  </tr>
                  <tr>
                    <td>Reason</td>
                    <td>{commandDetail.reason}</td>
                  </tr>
                  <tr>
                    <td>Created At</td>
                    <td>{commandDetail.createdAt}</td>
                  </tr>
                  <tr>
                    <td>Updated At</td>
                    <td>{commandDetail.updatedAt}</td>
                  </tr>
                  <tr>
                    <td>Details</td>
                    <td>
                      {
                        Object.keys(commandDetail.details).map(key => {
                          return(
                            <div key={key+commandDetail[key]}>
                              <Label bsStyle="info">{key}</Label>&nbsp;<span>{commandDetail.details[key]}</span>
                            </div>
                          )
                        })
                      }
                    </td>
                  </tr>
                </tbody>
              </Table>
            }
          </Modal.Body>
          <Modal.Footer>
            <Button className="btn-fill" onClick={this.handleCommandDetailClose}>Close</Button>
          </Modal.Footer>
        </Modal>
        <Modal show={this.state.commandShow} onHide={this.handleCommandClose}>
          <Modal.Header closeButton>
            <Modal.Title>Device Command</Modal.Title>
          </Modal.Header>
          <Modal.Body>Are you sure to {message}?</Modal.Body>
          <Modal.Footer>
            <Button className="btn-fill" onClick={this.handleCommandClose}>Close</Button>
            <Button bsStyle="warning" className="btn-fill" active onClick={() => this.createCommand()}>Confirm</Button>
          </Modal.Footer>
          { creatingCommand &&
            <div>
              <ProgressBar active now={50} />
            </div>
          }
        </Modal>
        <Modal show={this.state.eventDetailShow} onHide={this.handleEventDetailClose}>
          <Modal.Header closeButton>
            <Modal.Title>Event Detail</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            { eventDetailLoading &&
              <div>
                <ProgressBar active now={50} />
              </div>
            }
            { eventDetailError &&
              <Alert bsStyle="danger">
                <span>{this.state.eventDetailError}</span>
              </Alert>
            }
            { eventDetail &&
              <Table striped bordered>
                <tbody>
                  <tr>
                    <td>ID</td>
                    <td>{eventDetail.id}</td>
                  </tr>
                  <tr>
                    <td>Device ID</td>
                    <td>{eventDetail.deviceId}</td>
                  </tr>
                  <tr>
                    <td>Message</td>
                    <td>{eventDetail.message}</td>
                  </tr>
                  <tr>
                    <td>Details</td>
                    <td>
                      {
                        Object.keys(eventDetail.details).map(key => {
                          return(
                            <div key={key+eventDetail.details[key]}>
                              <Label bsStyle="info">{key}</Label>&nbsp;<span>{eventDetail.details[key]}</span>
                            </div>
                          )
                        })
                      }
                    </td>
                  </tr>
                  <tr>
                    <td>Type</td>
                    <td>{eventDetail.type}</td>
                  </tr>
                  <tr>
                    <td>Created At</td>
                    <td>{eventDetail.createdAt}</td>
                  </tr>
                  <tr>
                    <td>Sent At</td>
                    <td>{eventDetail.sentAt}</td>
                  </tr>
                  <tr>
                    <td>Updated At</td>
                    <td>{eventDetail.updatedAt}</td>
                  </tr>
                  <tr>
                    <td>Acknowledged</td>
                    <td>{eventDetail.ack ? "Read" : "Unread"}</td>
                  </tr>
                </tbody>
              </Table>
            }
          </Modal.Body>
          <Modal.Footer>
            <Button className="btn-fill" onClick={this.handleEventDetailClose}>Close</Button>
          </Modal.Footer>
        </Modal>
        { device &&
        <Row>
          <Col md={12}>
            <Button className="btn-fill pull-right" bsSize="small" onClick={this.props.goTop}>Top</Button>
          </Col>
        </Row>
        }
      </div>
    )
  }
}

export default DeviceDetail;
