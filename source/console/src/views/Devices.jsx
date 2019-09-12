import React, { Component } from "react";
import { API } from "aws-amplify";
import {
  Button,
  FormControl,
  Grid,
  Row,
  Col,
  FormGroup,
  ControlLabel,
  ProgressBar,
  Alert,
  Table,
  Modal
} from 'react-bootstrap';

import { Card } from "components/Card/Card.jsx";

class Devices extends Component {
  constructor(props) {
    super(props);

    this.handleRegisterDevice = this.handleRegisterDevice.bind(this);
    this.handleDevice = this.handleDevice.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleDeleteClose = this.handleDeleteClose.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
    this.handleOrderChange = this.handleOrderChange.bind(this);

    // Sets up initial state
    this.state = {
      devices: [],
      error: false,
      isLoading: false,
      show: false,
      deviceName: '',
      deviceId: '',
      isDeleting: false,
      title: '',
    };
  }

  componentDidMount() {
    this.setState({ title: 'My Devices', });
    this.getDevices();
  }

  // Registers a device
  handleRegisterDevice() {
    this.props.history.push('/devices/registration');
  }

  // Gets a device detail
  handleDevice(deviceId) {
    this.props.history.push(`/devices/${deviceId}`);
  }

  // Handles to delete a device
  handleDelete = (deviceId, deviceName) => {
    this.setState({
      deviceName: deviceName,
      deviceId: deviceId,
      show: true,
    });
  }

  // Delets a device
  deleteDevice = async (deviceId) => {
    if (!this.state.isDeleting) {
      this.setState({ isDeleting: true });

      let token = await this.props.getToken();
      let apiName = 'smart-product-api';
      let path = `devices/${deviceId}`;
      let params = {
        headers: {
          'Authorization': token,
        },
        response: true,
      };

      API.del(apiName, path, params)
        .then(_response => {
          this.props.handleNotification('Device was deleted successfully', 'success', 'pe-7s-close-circle', 5);

          let updatedDevices = this.state.devices.filter(device => device.thingName !== deviceId);
          this.setState({ 
            devices: updatedDevices,
            title: `My Devices (${updatedDevices.length})`
          });
        })
        .catch(error => {
          this.props.handleNotification('Error occurred while deleting the device', 'error', 'pe-7s-close-circle', 5);
        })
        .finally(() => {
          this.setState({
            isDeleting: false,
            show: false,
          });
        });
    } else {
      this.props.handleNotification('Device is still deleting', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  handleDeleteClose = () => {
    this.setState({ show: false });
  }

  // Handles input changes
  handleFilter = () => {
    // Gets element value directly due to the stale state
    let connected = document.getElementById("status").value;
    let keyword = document.getElementById("keyword").value;
    let devices = this.state.devices;

    for (let i = 0; i < devices.length; i++) {
      let deviceName = devices[i].attributes.deviceName;
      let modelNumber = devices[i].attributes.modelNumber;
      let thingName = devices[i].thingName;
      let connectivity = devices[i].connectivity.connected ? 'connected' : 'disconnected';

      if (keyword === '' && connected === '') {
        // Empty keyword and All status
        devices[i].visible = true;
      } else if (keyword === '') {
        // Empty keyword and certain status
        if (connectivity === connected) {
          devices[i].visible = true;
        } else {
          devices[i].visible = false;
        }
      } else if (connected === '') {
        // Some keyword and All status and
        if (deviceName.indexOf(keyword) > -1
          || modelNumber.indexOf(keyword) > -1
          || thingName.indexOf(keyword) > -1) {
          devices[i].visible = true;
        } else {
          devices[i].visible = false;
        }
      } else {
        // Some keyword and certain status
        if (deviceName.indexOf(keyword) > -1
        || modelNumber.indexOf(keyword) > -1
        || thingName.indexOf(keyword) > -1) {
          if (connectivity === connected) {
            devices[i].visible = true;
          } else {
            devices[i].visible = false;
          }
        } else {
          devices[i].visible = false;
        }
      }
    }

    this.setState({ devices: devices });
  }

  handleOrderChange = (event) => {
    let order = event.target.value;
    this.sortDevices(order);
  };

  // Sorts devices
  sortDevices = (order) => {
    let devices = this.state.devices;
    if (order === 'asc') {
      devices.sort((a, b) => a.attributes.deviceName.localeCompare(b.attributes.deviceName));
    } else if (order === 'desc') {
      devices.sort((a, b) => b.attributes.deviceName.localeCompare(a.attributes.deviceName));
    }

    this.setState({ devices: devices });
  };

  // Gets devices
  getDevices = async () => {
    this.setState({ isLoading: true });
    let token = await this.props.getToken();
    let apiName = 'smart-product-api';
    let path = 'devices';
    let params = {
      headers: {
        'Authorization': token,
      },
      response: true,
    };
    API.get(apiName, path, params)
      .then(response => {
        let devices = response.data;

        // Adds visible key/value for filter
        for (let i = 0; i < devices.length; i++) {
          devices[i]['visible'] = true;
        }

        // Sorts initially
        devices.sort((a, b) => a.attributes.deviceName.localeCompare(b.attributes.deviceName));
        this.setState({ 
          devices: devices,
          title: `My Devices (${devices.length})`,
        });
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

  render() {
    const { isLoading, isDeleting, error, devices, deviceName, title } = this.state;
    return (
      <div className="content">
        <Grid fluid>
          <Row>
            <Col md={12}>
              <Button className="btn-fill pull-right" bsSize="small" bsStyle="warning" active onClick={this.handleRegisterDevice}>Register a Device</Button>
            </Col>
          </Row>
          <Row>
            <Col md={12}>
              <span>&nbsp;</span>
            </Col>
          </Row>
          <Row>
            <Col md={12}>
              <Card
                title={title}
                content={
                  <div>
                    <Col md={4}>
                      <FormGroup>
                        <ControlLabel>Search Keyword</ControlLabel>
                        <FormControl placeholder="Search by Device Name, Serial number or Model number"
                          type="text" defaultValue="" onChange={this.handleFilter} id="keyword" />
                      </FormGroup>
                    </Col>
                    <Col md={4}>
                      <FormGroup>
                        <ControlLabel>Filter by Device Status</ControlLabel>
                        <FormControl componentClass="select" defaultValue="" onChange={this.handleFilter} id="status">
                          <option value="">All</option>
                          <option value="connected">Connected</option>
                          <option value="disconnected">Disconnected</option>
                        </FormControl>
                      </FormGroup>
                    </Col>
                    <Col md={4}>
                      <FormGroup>
                        <ControlLabel>Sort By</ControlLabel>
                        <FormControl componentClass="select" defaultValue="asc" onChange={this.handleOrderChange}>
                          <option value="asc">A-Z</option>
                          <option value="desc">Z-A</option>
                        </FormControl>
                      </FormGroup>
                    </Col>
                    <div className="clearfix" />
                  </div>
                }
              />
            </Col>
          </Row>
          <Row>
            {
              devices.length === 0 && !isLoading &&
              <Col md={12}>
                <Card content={<div>No device found.</div>} />
              </Col>
            }
            {
              devices
                .filter(device => device.visible)
                .map(device => {
                  return (
                    <Col md={4} key={device.thingName}>
                      <Card title={device.attributes.deviceName}
                        content={
                          <div>
                            <Table striped bordered>
                              <tbody>
                                <tr>
                                  <td>Serial<br />Number</td>
                                  <td>{device.thingName}</td>
                                </tr>
                                <tr>
                                  <td>Model<br />Number</td>
                                  <td>{device.attributes.modelNumber}</td>
                                </tr>
                                <tr>
                                  <td>Connected</td>
                                  <td>{device.connectivity.connected ? "Connected" : "Disconnected"}</td>
                                </tr>
                              </tbody>
                            </Table>
                            <Button bsStyle="danger" bsSize="small"
                              className="btn-fill pull-left" active
                              onClick={() => this.handleDelete(device.thingName, device.attributes.deviceName)}>Delete</Button>
                            <Button bsStyle="warning" bsSize="small"
                              className="btn-fill pull-right" active
                              onClick={() => this.handleDevice(device.thingName)}>Detail</Button>
                            <div className="clearfix" />
                          </div>
                        }
                      />
                    </Col>
                  )
              })
            }
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
        <Modal show={this.state.show} onHide={this.handleDeleteClose}>
          <Modal.Header closeButton>
            <Modal.Title>Delete Device</Modal.Title>
          </Modal.Header>
          <Modal.Body>Are you sure to delete the device {deviceName}?</Modal.Body>
          <Modal.Footer>
            <Button onClick={this.handleDeleteClose}>Close</Button>
            <Button bsStyle="primary" className="btn-fill" active onClick={() => this.deleteDevice(this.state.deviceId)}>Delete</Button>
          </Modal.Footer>
          { isDeleting &&
            <div>
              <ProgressBar active now={50} />
            </div>
          }
        </Modal>
      </div>
    );
  }
}

export default Devices;
