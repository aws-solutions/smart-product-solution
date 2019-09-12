import React, { Component } from "react";
import { API } from "aws-amplify";
import {
  Grid,
  Row,
  Col,
  Table,
  Alert,
  Button,
  Label,
  ProgressBar,
  FormControl,
  FormGroup,
  ControlLabel,
  Modal
} from "react-bootstrap";

import Card from "components/Card/Card.jsx";

class History extends Component {
  constructor(props) {
    super(props);

    this.handleDeviceNameChange = this.handleDeviceNameChange.bind(this);
    this.handleEventTypeChange = this.handleEventTypeChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleEventDetailShow = this.handleEventDetailShow.bind(this);
    this.handleEventDetailClose = this.handleEventDetailClose.bind(this);

    // Sets up initial state
    this.state = {
      error: false,
      hasMore: true,
      isLoading: false,
      devices: [],
      events: [],
      lastevalkey: null,
      deviceId: '',
      updatedDeviceId: '',
      eventType: '',
      updatedEventType: '',
      show: false,
      eventDetail: false,
      eventDetailError: false,
      eventDetailLoading: false,
      isInit: true,
      isMinimized: false,
      isPacked: false,
    };
  }

  componentDidMount() {
    this.handleResize();
    this.getDevices();
    this.getHistory();
    window.addEventListener('scroll', this.handleScroll);
    window.addEventListener('resize', this.handleResize);
  }

  componentWillUnmount() {
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);
  }

  // Handles scroll down to load more
  handleScroll = (_event) => {
    const {error, isLoading, hasMore} = this.state;
    if (error || isLoading || !hasMore) return;

    if (this.props.isScrollBottom() && !this.state.isInit) {
      this.getHistory();
    }

    this.setState({ isInit: false });
  };

  // Handles window resize
  handleResize = (_event) => {
    if (window.innerWidth < 993) {
      this.setState({ isMinimized: true, });
    } else {
      this.setState({ isMinimized: false, });

      if (window.innerWidth < 1380) {
        this.setState({ isPacked: true, });
      } else {
        this.setState({ isPacked: false, });
      }
    }
  };

  // Handles submit
  handleSubmit = async event => {
    event.preventDefault();
    this.setState({
      events: [],
      lastevalkey: null,
      error: false,
      eventType: this.state.updatedEventType,
      deviceId: this.state.updatedDeviceId,
    });
    this.getHistory();
  };

  // Gets devices for the user
  getDevices = async() => {
    this.setState({ isLoading: true });
    let token = await this.props.getToken();
    let apiName = 'smart-product-api';
    let path = 'registration';
    let params = {
      headers: {
        'Authorization': token,
      },
      response: true,
    };
    API.get(apiName, path, params)
      .then(response => {
        let devices = response.data;
        this.setState({ devices: devices });
      })
      .catch(error => {
        let message = error.response;
        if (message === undefined) {
          message = error.message;
        } else {
          message = error.response.data.message;
        }

        this.setState({ error: message, });
      })
      .finally(() => {
        this.setState({ isLoading: false, });
      });
  };

  // Gets event history for the user
  getHistory = async () => {
    this.setState({ isLoading: true});
    let token = await this.props.getToken();
    let apiName = 'smart-product-api';
    let path = 'devices/events';
    let params = {
      headers: {
        'Authorization': token,
      },
      response: true,
      queryStringParameters: {
        lastevalkey: JSON.stringify(this.state.lastevalkey),
        deviceId : this.state.deviceId,
        eventType: this.state.eventType
      }
    };

    API.get(apiName, path, params)
      .then(response => {
        /**
         * If response has no data and lastevalkey is null, there is no more data.
         * Otherwise, show the data.
         */
        if (response.data.Items.length === 0
          && (response.data.LastEvaluatedKey === null
            || response.data.LastEvaluatedKey === undefined)) {
          this.setState({ hasMore: false, });
        } else {
          this.setState({
            hasMore: response.data.LastEvaluatedKey !== undefined,
            lastevalkey: response.data.LastEvaluatedKey,
            deviceId: response.data.deviceId,
            eventType: response.data.eventType,
            events: [
              ...this.state.events,
              ...response.data.Items
            ]
          });
        }
      })
      .catch(error => {
        let message = error.response;
        if (message === undefined) {
          message = error.message;
        } else {
          message = error.response.data.message;
        }

        this.setState({ error: message, });
      })
      .finally(() => {
        this.setState({ isLoading: false, });
      });
  };

  // Handles input changes
  handleDeviceNameChange = (event) => {
    this.setState({ updatedDeviceId: event.target.value });
  }
  handleEventTypeChange = (event) => {
    this.setState({ updatedEventType: event.target.value });
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
      });

    this.setState({ show: true });
  }

  // Handles event detail close
  handleEventDetailClose = () => {
    this.setState({ show: false });
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
  };

  render() {
    const { error, isLoading, hasMore, devices, events, deviceId, eventType, eventDetailError, eventDetail, eventDetailLoading } = this.state;
    const { isMinimized, isPacked } = this.state;
    const thArray = ['Event Message', 'Device Name', 'Event Type', 'Created At'];

    return (
      <div className="content">
        <Grid fluid>
          <Row>
            <Col md={12}>
              <Card
                title="Event History"
                content={
                  <form onSubmit={this.handleSubmit}>
                    <Col md={6}>
                      <FormGroup>
                        <ControlLabel>Search by Device Name</ControlLabel>
                        <FormControl componentClass="select"
                          onChange={this.handleDeviceNameChange} defaultValue={deviceId}>
                          <option value="">All</option>
                          {
                            devices.map(device => {
                              return(
                                <option key={device.deviceId} value={device.deviceId}>{device.deviceName}</option>
                              )
                            })
                          }
                        </FormControl>
                      </FormGroup>
                    </Col>
                    <Col md={6}>
                      <FormGroup>
                        <ControlLabel>Search by Event Type</ControlLabel>
                        <FormControl componentClass="select" placeholder={this.state.eventType}
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
                          thArray.map((prop, key) => {
                            return (
                              <th key={key}>{prop}</th>
                            );
                          })
                        }
                      </tr>
                    </thead>
                    <tbody>
                      {/* If there is no event, showing no event found */}
                      { events.length === 0 && !isLoading && !hasMore &&
                        <tr>
                          <td colSpan="4" align="center">No event found.</td>
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
                              <td key={event.id+event.deviceName}>
                                <div className="custom_devicename_td">
                                  {event.deviceName}
                                </div>
                              </td>
                              <td key={event.id+event.type} className="custom_event_type_td">
                              { event.type === 'info' &&
                                <Label bsStyle="info">{event.type}</Label>
                              }
                              { event.type === 'warning' &&
                                <Label bsStyle="warning">{event.type}</Label>
                              }
                              { event.type === 'error' &&
                                <Label bsStyle="danger">{event.type}</Label>
                              }
                              { event.type === 'diagnostic' &&
                                <Label bsStyle="default">{event.type}</Label>
                              }
                              </td>
                              <td key={event.id+event.createdAt} className="custom_date_td">
                                { isPacked && this.props.handleDateSize(event.createdAt) }
                                { !isPacked && event.createdAt }
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
                  { events.length === 0 && !isLoading && !hasMore &&
                    <div className="custom_list_item">
                      <span className="no_result">No event found.</span>
                    </div>
                  }
                  { events.map(event => {
                      return (
                        <div className="custom_list_item" key={event.id} onClick={() => this.handleEventDetailShow(event.deviceId, event.id)}>
                          <span className="custom_mobile_date">
                            <span className="mobile_date">{this.props.handleDateSize(event.createdAt)}</span>
                          </span>
                          <span className="custom_mobile_title">
                            <span className="mobile_title">{event.deviceName}</span>
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
          { isLoading &&
            <Row>
              <Col md={12}>
                <div>
                  <ProgressBar active now={50} />
                </div>
              </Col>
            </Row>
          }
          { error &&
            <Row>
              <Col md={12}>
                <Alert bsStyle="danger">
                  <span>{this.state.error}</span>
                </Alert>
              </Col>
            </Row>
          }
        </Grid>
        <Modal show={this.state.show} onHide={this.handleEventDetailClose}>
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
        <Row>
          <Col md={12}>
            <Button className="btn-fill pull-right" bsSize="small" onClick={this.props.goTop}>Top</Button>
          </Col>
        </Row>
      </div>
    );
  }
}

export default History;
