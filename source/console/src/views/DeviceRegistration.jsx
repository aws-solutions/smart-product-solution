import React, { Component } from "react";
import { API } from "aws-amplify";
import {
  Grid,
  Row,
  Col,
  Button,
  ProgressBar,
  Alert,
  FormGroup,
  ControlLabel,
  FormControl,
  HelpBlock,
  Well
} from "react-bootstrap";

import { Card } from "components/Card/Card.jsx";

class DeviceRegistration extends Component {
  constructor(props) {
    super(props);

    this.goBack = this.goBack.bind(this);
    this.register = this.register.bind(this);
    this.finish = this.finish.bind(this);

    this.handleSerialNumberChange = this.handleSerialNumberChange.bind(this);
    this.handleDeviceNameChange = this.handleDeviceNameChange.bind(this);
    this.handleModelNumberChange = this.handleModelNumberChange.bind(this);

    this.state = {
      step: 0,
      serialNumber: '',
      deviceName: '',
      modelNumber: '',
      isLoading: false,
      error: false,
      serialNumberValidateState: null,
      showSerialNumberHelpBlock: false,
      deviceNameValidateState: null,
      showDeviceNameHelpBlock: false,
      modelNumberValidateState: null,
      showModelNumberHelpBlock: false,
      isRegistering: false,
    };
  };

  componentDidMount() {
    // Checks if the previous page sends a state.
    // It would only happens when the device is pending to be registered, and a user wants to see the registration instruction again.
    const state = this.props.location.state;
    if (state) {
      let deviceId = state.deviceId;
      this.setState({
        step: 1,
        serialNumber: deviceId
      });
    }
  }

  goBack() {
    this.props.history.push('/devices');
  }

  // Handles input changes
  handleSerialNumberChange = (event) => {
    this.setState({ serialNumber: event.target.value }, () => {
      this.serialNumberValidate();
    });
  }
  handleDeviceNameChange = (event) => {
    this.setState({ deviceName: event.target.value }, () => {
      this.validateInput('deviceName');
    });
  }
  handleModelNumberChange = (event) => {
    this.setState({ modelNumber: event.target.value }, () => {
      this.validateInput('modelNumber');
    });
  }

  // Validates serial number
  serialNumberValidate = () => {
    let serialNumber = this.state.serialNumber;

    let regexp = /^[a-zA-Z0-9-_:]+$/;
    let pass = regexp.test(serialNumber);
    if (pass) {
      this.setState({
        showSerialNumberHelpBlock: false,
        serialNumberValidateState: null,
      });
    } else {
      this.setState({
        showSerialNumberHelpBlock: true,
        serialNumberValidateState: 'error',
      });
    }

    return pass;
  }

  // Validates inputs
  validateInput = (type) => {
    let regexp = /^[a-zA-Z0-9-_.,:/@#]+$/;
    let pass = false;
    let input = '';

    switch (type) {
      case 'deviceName': {
        input = this.state.deviceName;
        pass = regexp.test(input);

        if (pass) {
          this.setState({
            showDeviceNameHelpBlock: false,
            deviceNameValidateState: null,
          });
        } else {
          this.setState({
            showDeviceNameHelpBlock: true,
            deviceNameValidateState: 'error',
          });
        }
        break;
      }
      case 'modelNumber': {
        input = this.state.modelNumber;
        pass = regexp.test(input);

        if (pass) {
          this.setState({
            showModelNumberHelpBlock: false,
            modelNumberValidateState: null,
          });
        } else {
          this.setState({
            showModelNumberHelpBlock: true,
            modelNumberValidateState: 'error',
          });
        }
        break;
      }
      default : {
        // do nothing
        break;
      }
    }

    return pass;
  }

  // Registers device
  register = async () => {
    this.setState({ error: false, });
    if (!this.state.isRegistering) {
      this.setState({ isRegistering: true });
      let isSerialNumberValidated = this.serialNumberValidate();
      let isDeviceNameValidated = this.validateInput('deviceName');
      let isModelNumberValidated = this.validateInput('modelNumber');

      if (!isSerialNumberValidated || !isDeviceNameValidated || !isModelNumberValidated) {
        this.props.handleNotification('Check input variables', 'error', 'pe-7s-check', 5);

        this.setState({ isRegistering: false });
      } else {
        this.setState({ isLoading: true });

        let token = await this.props.getToken();
        let apiName = 'smart-product-api';
        let path = 'registration';
        let params = {
          body: {
            modelNumber: this.state.modelNumber,
            deviceId: this.state.serialNumber,
            deviceName: this.state.deviceName,
          },
          headers: {
            'Authorization': token
          }
        };

        API.post(apiName, path, params)
          .then(response => {
            this.setState({
              step: 1
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
            this.setState({
              isLoading: false,
              isRegistering: false,
            });
          });
      }
    } else {
      this.props.handleNotification('Device is still registering', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  finish = () => {
    let deviceId = this.state.serialNumber;
    this.props.history.push(`/devices/${deviceId}`);
  }

  render() {
    const { isLoading, error,
      serialNumberValidateState, showSerialNumberHelpBlock,
      deviceNameValidateState, showDeviceNameHelpBlock,
      modelNumberValidateState, showModelNumberHelpBlock,
    } = this.state;

    if (this.state.step === 1) {
      return (
        <div className="content">
          <Grid fluid>
            <Row>
              <Col md={10} mdOffset={1}>
                <Card
                  title="Device Registered"
                  content={
                    <div className="custom_registration">
                      <div>
                        To finish the registration, you can follow the below instruction.<br/>
                        <ul>
                          <li>
                            Login to the device with SSH, and register your CA certificate.
                            <Well bsSize="small">
                              $ openssl genrsa -out sampleCACertificate.key 2048<br/>
                              $ openssl req -x509 -new -nodes -key sampleCACertificate.key -sha256 -days 365 -out sampleCACertificate.pem
                            </Well>
                          </li>
                          <li>
                            Get registration code using the AWS CLI, and copy "registrationCode".
                            <Well bsSize="small">
                              $ aws iot get-registration-code
                            </Well>
                          </li>
                          <li>
                            Create a CSR. During the creation process, enter the registration code into the "Common Name" field.<br/>
                            <Well bsSize="small">
                              $ openssl genrsa -out privateKeyVerification.key 2048<br/>
                              $ openssl req -new -key privateKeyVerification.key -out privateKeyVerification.csr<br/>
                              ...<br/>
                              Common Name (e.g. server FQDN or YOUR name) []: <font color="red">registrationCode</font>
                            </Well>
                          </li>
                          <li>
                            Use your first sample CA certificate and the CSR to create a new certificate.
                            <Well bsSize="small">
                              $ openssl x509 -req -in privateKeyVerification.csr -CA sampleCACertificate.pem -CAkey sampleCACertificate.key -CAcreateserial -out privateKeyVerification.crt -days 365 -sha256
                            </Well>
                          </li>
                          <li>
                            Use the verification certificate to register your sample CA certificate, and copy "certificateId".
                            <Well bsSize="small">
                              $ aws iot register-ca-certificate --ca-certificate file://sampleCACertificate.pem --verification-certificate file://privateKeyVerification.crt
                            </Well>
                          </li>
                          <li>
                            Activate the CA certificate, and enable the auto-registration-status.
                            <Well bsSize="small">
                              $ aws iot update-ca-certificate --new-status ACTIVE --new-auto-registration-status ENABLE --certificate-id <font color="red">&lt;certificateId&gt;</font>
                            </Well>
                          </li>
                          <li>
                            Create a device certificate. During the creation process, enter the serial number into the "Common Name" field.
                            <Well bsSize="small">
                              $ openssl genrsa -out deviceCert.key 2048<br/>
                              $ openssl req -new -key deviceCert.key -out deviceCert.csr<br/>
                              ...<br/>
                              Common Name (e.g. server FQDN or YOUR name) []: <font color="red">{this.state.serialNumber}</font><br/><br/>
                              $ openssl x509 -req -in deviceCert.csr -CA sampleCACertificate.pem -CAkey sampleCACertificate.key -CAcreateserial -out deviceCert.crt -days 365 -sha256
                            </Well>
                          </li>
                          <li>
                            Download the root certificate.
                            <Well bsSize="small" className="custom_well">
                              $ curl -o root.cert https://www.amazontrust.com/repository/AmazonRootCA1.pem
                            </Well>
                          </li>
                          <li>
                            Get AWS IoT endpoint, and copy the value.
                            <Well bsSize="small">
                              $ aws iot describe-endpoint --endpoint-type iot:Data-ATS --output text
                            </Well>
                          </li>
                          <li>
                            Try to connect to AWS IoT using the device certificate.
                            <Well bsSize="small">
                              $ cat deviceCert.crt sampleCACertificate.pem &gt; deviceCertAndCACert.crt<br/>
                              $ mosquitto_pub --cafile root.cert --cert deviceCertAndCACert.crt --key deviceCert.key -p 8883 -q 1 -t foo/bar -i anyclientID --tls-version tlsv1.2 -m "Hello" -d -h <font color="red">YOUR_IOT_ENDPOINT</font>
                            </Well>
                          </li>
                          <li>
                            You will see a TLS failure when you run the command because AWS IoT disconnects the connection after the registration of the device certificate.
                          </li>
                          <li>
                            Click "Finish" to see your device.
                          </li>
                        </ul>
                        For more information, please refer to <a href="https://aws.amazon.com/blogs/iot/just-in-time-registration-of-device-certificates-on-aws-iot/" target="_blank" rel="noopener noreferrer">Just-in-Time Registration of Device Certificates on AWS IoT</a>.
                      </div>
                      <Button className="btn-fill pull-right" active bsSize="small" onClick={this.finish}>Finish</Button>
                      <div className="clearfix" />
                    </div>
                  }
                />
              </Col>
            </Row>
          </Grid>
        </div>
      );
    } else {
      return (
        <div className="content">
          <Grid fluid>
            <Row>
              <Col md={8} mdOffset={2}>
                <Card
                  title="Device Registration"
                  content={
                    <div>
                      <Col md={12}>
                        <FormGroup controlId="formSerialNumber" validationState={serialNumberValidateState}>
                          <ControlLabel>Serial Number</ControlLabel>
                          <FormControl type="text" placeholder="Enter the serial number" defaultValue="" onChange={this.handleSerialNumberChange} />
                          { showSerialNumberHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters and/or the following: -_:</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                      <FormGroup controlId="formDeviceName" validationState={deviceNameValidateState}>
                          <ControlLabel>Device Name</ControlLabel>
                          <FormControl type="text" placeholder="Enter the device name" defaultValue="" onChange={this.handleDeviceNameChange} />
                          { showDeviceNameHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters and/or the following: -_.,:/@#</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                      <FormGroup controlId="formModelNumber" validationState={modelNumberValidateState}>
                          <ControlLabel>Model Number</ControlLabel>
                          <FormControl type="text" placeholder="Enter the model number" defaultValue="" onChange={this.handleModelNumberChange} />
                          { showModelNumberHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters and/or the following: -_.,:/@#</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={12}>
                        <Button className="btn-fill pull-right" bsSize="small" bsStyle="warning" active onClick={this.register}>Register</Button>
                        <Button className="btn-fill" bsSize="small" onClick={this.goBack}>Cancel</Button>
                      </Col>
                      <div className="clearfix" />
                    </div>
                  }
                />
              </Col>
            </Row>
            { isLoading &&
              <Row>
                <Col md={8} mdOffset={2}>
                  <div>
                    <ProgressBar active now={50} />
                  </div>
                </Col>
              </Row>
            }
            { error &&
              <Row>
                <Col md={8} mdOffset={2}>
                  <Alert bsStyle="danger">
                    <span>{this.state.error}</span>
                  </Alert>
                </Col>
              </Row>
            }
          </Grid>
        </div>
      );
    }
  }
}

export default DeviceRegistration;
