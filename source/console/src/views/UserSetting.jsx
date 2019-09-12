import React, { Component } from "react";
import { API, Auth } from "aws-amplify";
import {
  Grid,
  Row,
  Col,
  Button,
  ProgressBar,
  Alert,
  FormGroup,
  FormControl,
  ControlLabel,
  HelpBlock,
  Table
} from "react-bootstrap";

import { Card } from "components/Card/Card.jsx";
import Checkbox from "components/CustomCheckbox/CustomCheckbox.jsx";

class UserSetting extends Component {
  constructor(props) {
    super(props);

    this.handleAlertLevelChange = this.handleAlertLevelChange.bind(this);
    this.handleSendNotificationChange = this.handleSendNotificationChange.bind(this);
    this.handleCurrentPasswordChange = this.handleCurrentPasswordChange.bind(this);
    this.handleNewPasswordChange = this.handleNewPasswordChange.bind(this);
    this.handleConfirmNewPasswordChange = this.handleConfirmNewPasswordChange.bind(this);

    this.state = {
      userInfo: '',
      alertLevel: '',
      updatedAlertLevel: '',
      sendNotification: false,
      updatedSendNotification: false,
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
      isLoading: false,
      isAlertUpdating: false,
      isPasswordUpdating: false,
      alertLevelError: false,
      passwordError: false,
      showCurrentPassowrdHelpBlock: false,
      showNewPasswordHelpBlock: false,
      showConfirmPasswordHelpBlock: false,
      currentPasswordHelpMessage: '',
      newPasswordHelpMessage: '',
      confirmPasswordHelpMessage: '',
      currentPasswordValidateState: null,
      newPasswordValidateState: null,
      confirmPasswordValidateState: null,
    };
  }

  componentDidMount() {
    this.getProfile();
  }

  // Gets user profile setting
  getProfile = async () => {
    this.setState({ isLoading: true, alertLevelError: false });
    let user = await Auth.currentAuthenticatedUser();

    // Sets user information
    this.setState({ userInfo: user.attributes });

    let token = await this.props.getToken();
    let settingId = this.state.userInfo.sub;

    let apiName = 'smart-product-api';
    let path = `admin/settings/config/${settingId}`;
    let params = {
      headers: {
        'Authorization': token,
      },
      response: true,
    };

    API.get(apiName, path, params)
      .then(response => {
        this.setState({
          alertLevel: [...response.data.setting.alertLevel].sort(),
          updatedAlertLevel: [...response.data.setting.alertLevel],
          sendNotification: response.data.setting.sendNotification,
          updatedNotification: response.data.setting.sendNotification
        });
      })
      .catch(error => {
        let message = error.response;
        if (message === undefined) {
          message = error.message;
        } else {
          message = error.response.data.message;
        }

        this.setState({ alertLevelError: message });
      })
      .finally(() => {
        this.setState({ isLoading: false });
      });
  };

  // Updates user profile setting
  updateProfile = async (mode) => {
    if (mode === 'password') {
      this.setState({
        passwordError: false,
      });

      if (!this.state.isPasswordUpdating) {
        let {currentPassword, newPassword} = this.state;

        // Updates password
        if (this.passwordValidate() && currentPassword !== '') {
          this.setState({ isPasswordUpdating: true, passwordError: false });
          Auth.currentAuthenticatedUser()
            .then(user => {
              return Auth.changePassword(user, currentPassword, newPassword);
            })
            .then(_data => {
               this.props.handleNotification('Password update completed', 'success', 'pe-7s-check', 5);
            })
            .catch(error => {
              this.setState({ passwordError: error.message });
            })
            .finally(() => {
              this.setState({
                isPasswordUpdating: false,
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: '',
              });
            });
        } else if (!this.passwordValidate()) {
          this.props.handleNotification('Check password', 'error', 'pe-7s-check', 5);
        } else {
          this.props.handleNotification('Nothing to update', 'warning', 'pe-7s-check', 5);
        }
      } else {
        this.props.handleNotification('Updating password has not been completed yet', 'warning', 'pe-7s-close-circle', 5);
      }
    } else if (mode === 'alertLevel') {
      this.setState({
        alertLevelError: false,
      });

      if (!this.state.isAlertUpdating) {
        let token = await this.props.getToken();
        let settingId = this.state.userInfo.sub;

        // Updates user setting
        let sortedUpdatedAlertLevel = this.state.updatedAlertLevel.sort();
        if (!this.compareArray(this.state.alertLevel, sortedUpdatedAlertLevel)
          || this.state.sendNotification !== this.state.updatedSendNotification) {
          this.setState({ isAlertUpdating: true, alertLevelError: false });

          let apiName = 'smart-product-api';
          let path = `admin/settings/config/${settingId}`;
          let params = {
            headers: {
              'Authorization': token,
            },
            body: {
                alertLevel: this.state.updatedAlertLevel,
                sendNotification: this.state.updatedSendNotification
            },
            response: true,
          };

          API.put(apiName, path, params)
            .then(_response => {
              this.props.handleNotification('User setting update completed', 'success', 'pe-7s-check', 5);
              this.setState({ 
                alertLevel: [...sortedUpdatedAlertLevel],
                sendNotification: this.state.updatedSendNotification
              });
            })
            .catch(error => {
              let message = error.response;
              if (message === undefined) {
                message = error.message;
              } else {
                message = error.response.data.message;
              }

              this.setState({ alertLevelError: message });
            })
            .finally(() => {
              this.setState({ isAlertUpdating: false });
            });
        } else {
          this.props.handleNotification('Nothing to update', 'warning', 'pe-7s-check', 5);
        }
      } else {
        this.props.handleNotification('Updating alert level has not been completed yet', 'warning', 'pe-7s-close-circle', 5);
      }
    }
  };

  // Compares arrays
  compareArray = (a, b) => {
    if (a === b) return true;
    if (a === null || b === null
      || a === undefined || b === undefined
      || a.length !== b.length) return false;

    for (let idx = 0; idx < a.length; idx++) {
      if (a[idx] !== b[idx]) return false;
    }
    return true;
  };

  // Handles input changes
  handleAlertLevelChange = (event) => {
    const { id, checked } = event.target;
    let updatedAlertLevel = this.state.updatedAlertLevel;
    let alertLevel = this.state.alertLevel;

    if (checked) {
      updatedAlertLevel.push(id);
    } else {
      let index = updatedAlertLevel.indexOf(id);
      if (index > -1) {
        updatedAlertLevel.splice(index, 1);
      }
    }

    this.setState({
      alertLevel: alertLevel,
      updatedAlertLevel: updatedAlertLevel,
    });
  };
  handleSendNotificationChange = (event) => {
    this.setState({ updatedSendNotification: event.target.checked });
  };
  handleCurrentPasswordChange = (event) => {
    this.setState({ currentPassword: event.target.value }, () => {
      this.passwordValidate();
    });
  };
  handleNewPasswordChange = (event) => {
    this.setState({ newPassword: event.target.value }, () => {
      this.passwordValidate();
    });
  };
  handleConfirmNewPasswordChange = (event) => {
    this.setState({ confirmNewPassword: event.target.value }, () => {
      this.passwordValidate();
    });
  };

  // Validates password
  passwordValidate = () => {
    let pass = true;
    let currentPassword = this.state.currentPassword;
    let newPassword = this.state.newPassword;
    let confirmNewPassword = this.state.confirmNewPassword;

    if (
      currentPassword !== ''
      || newPassword !== ''
      || confirmNewPassword !== ''
    ) {
      // currentPassword === ''
      if (currentPassword === '') {
        this.setState({
          currentPasswordHelpMessage: 'To change password, enter the current password.',
          showCurrentPasswordHelpBlock: true,
          currentPasswordValidateState: 'error',
        });
        pass = false;
      } else {
        this.setState({
          showCurrentPasswordHelpBlock: false,
          currentPasswordValidateState: null,
        });
        pass = true;

        if (newPassword === '') {
          this.setState({
            newPasswordHelpMessage: 'Enter the new password.',
            showNewPasswordHelpBlock: true,
            newPasswordValidateState: 'error',
          });
          pass = false;
        }

        if (confirmNewPassword === '') {
          this.setState({
            confirmPasswordHelpMessage: 'Enter the new password.',
            showConfirmPasswordHelpBlock: true,
            confirmPasswordValidateState: 'error',
          });
          pass = false;
        }
      }

      // newPassword !== confirmNewPassword
      if (newPassword !== confirmNewPassword) {
        this.setState({
          confirmPasswordHelpMessage: 'Password is different from the new password.',
          showConfirmPasswordHelpBlock: true,
          confirmPasswordValidateState: 'error',
        });
        pass = false;
      } else {
        if (
          newPassword !== ''
          && confirmNewPassword !== ''
        ) {
          this.setState({
            showNewPasswordHelpBlock: false,
            newPasswordValidateState: null,
            showConfirmPasswordHelpBlock: false,
            confirmPasswordValidateState: null,
          });
          pass = true;
        }
      }

      // newPassword === currentPassword
      if (newPassword === currentPassword) {
        this.setState({
          newPasswordHelpMessage: 'New password is same with the current password.',
          showNewPasswordHelpBlock: true,
          newPasswordValidateState: 'error',
        });
        pass = false;
      } else if (newPassword !== '') {
        this.setState({
          showNewPasswordHelpBlock: false,
          newPasswordValidateState: null,
        });
      }
    } else {
      this.setState({
        showCurrentPasswordHelpBlock: false,
        showNewPasswordHelpBlock: false,
        showConfirmPasswordHelpBlock: false,
        currentPasswordValidateState: null,
        newPasswordValidateState: null,
        confirmPasswordValidateState: null,
      });
      pass = true;
    }

    return pass;
  };

  render() {
    const { showCurrentPasswordHelpBlock, showNewPasswordHelpBlock, showConfirmPasswordHelpBlock,
      currentPasswordValidateState, newPasswordValidateState, confirmPasswordValidateState,
      currentPasswordHelpMessage, newPasswordHelpMessage, confirmPasswordHelpMessage,
      alertLevel, isLoading, isAlertUpdating, isPasswordUpdating, sendNotification,
      alertLevelError, passwordError } = this.state;
    return (
      <div className="content">
        <Grid fluid>
          <Row>
            <Col md={8} mdOffset={2}>
              <Row>
                <Col md={6}>
                  <Card
                    title="Password"
                    content={ !isLoading &&
                    <div>
                      <FormGroup controlId="formCurrentPassword" validationState={currentPasswordValidateState}>
                        <ControlLabel>Current Password</ControlLabel>
                        <FormControl type="password" placeholder="Enter the current password" value={this.state.currentPassword} onChange={this.handleCurrentPasswordChange} />
                        { showCurrentPasswordHelpBlock &&
                          <HelpBlock>{currentPasswordHelpMessage}</HelpBlock>
                        }
                      </FormGroup>
                      <FormGroup controlId="formNewPassword" validationState={newPasswordValidateState}>
                        <ControlLabel>New Password</ControlLabel>
                        <FormControl type="password" placeholder="Enter the new password" value={this.state.newPassword} onChange={this.handleNewPasswordChange} />
                        { showNewPasswordHelpBlock &&
                          <HelpBlock>{newPasswordHelpMessage}</HelpBlock>
                        }
                      </FormGroup>
                      <FormGroup controlId="formConfirmNewPassword" validationState={confirmPasswordValidateState}>
                        <ControlLabel>Confirm New Password</ControlLabel>
                        <FormControl type="password" placeholder="Re-enter the new password" value={this.state.confirmNewPassword} onChange={this.handleConfirmNewPasswordChange} />
                        { showConfirmPasswordHelpBlock &&
                          <HelpBlock>{confirmPasswordHelpMessage}</HelpBlock>
                        }
                      </FormGroup>
                      <Button bsStyle="warning" bsSize="small" className="btn-fill pull-right" active onClick={() => this.updateProfile('password')}>Update Password</Button>
                      <div className="clearfix" />
                    </div>
                    }
                  />
                </Col>
                <Col md={6}>
                  <Card
                    title="Alert Profile Preference Level"
                    content={ !isLoading &&
                    <div>
                      <h6>
                        Select the type of alerts that you would like to receive notification for.
                      </h6>
                      <span>&nbsp;</span>
                      <Table>
                        <tbody>
                          <tr>
                            <td>
                              <Checkbox number="error"
                                isChecked={alertLevel.indexOf("error") > -1 ? true : false}
                                onClick={this.handleAlertLevelChange} />
                            </td>
                            <td>Error</td>
                          </tr>
                          <tr>
                            <td>
                              <Checkbox number="warning"
                                isChecked={alertLevel.indexOf("warning") > -1 ? true : false}
                                onClick={this.handleAlertLevelChange} />
                            </td>
                            <td>Warning</td>
                          </tr>
                          <tr>
                            <td>
                              <Checkbox number="info"
                                isChecked={alertLevel.indexOf("info") > -1 ? true : false}
                                onClick={this.handleAlertLevelChange} />
                            </td>
                            <td>Info</td>
                          </tr>
                          <tr>
                            <td>
                              <Checkbox number="diagnostic"
                                isChecked={alertLevel.indexOf("diagnostic") > -1 ? true : false}
                                onClick={this.handleAlertLevelChange} />
                            </td>
                            <td>Diagnostic</td>
                          </tr>
                          <tr>
                            <td>
                              <Checkbox number="sendNotification" isChecked={sendNotification} onClick={this.handleSendNotificationChange} />
                            </td>
                            <td>
                              Get SMS (Message rates may apply)
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2}>
                              <strong>* Note that SMS is not supported in every region.</strong>
                            </td>
                          </tr>
                        </tbody>
                      </Table>
                      <Button bsStyle="warning" bsSize="small" className="btn-fill pull-right" active onClick={() => this.updateProfile('alertLevel')}>Update Alert Level</Button>
                      <div className="clearfix" />
                    </div>
                    }
                  />
                </Col>
              </Row>
            </Col>
          </Row>
          { (isLoading || isPasswordUpdating || isAlertUpdating) &&
              <Row>
                <Col md={8} mdOffset={2}>
                  <div>
                    <ProgressBar active now={50} />
                  </div>
                </Col>
              </Row>
            }
            { passwordError &&
              <Row>
                <Col md={8} mdOffset={2}>
                  <Alert bsStyle="danger">
                    <span>{passwordError}</span>
                  </Alert>
                </Col>
              </Row>
            }
            { alertLevelError &&
              <Row>
                <Col md={8} mdOffset={2}>
                  <Alert bsStyle="danger">
                    <span>{alertLevelError}</span>
                  </Alert>
                </Col>
              </Row>
            }
        </Grid>
      </div>
    )
  }
}

export default UserSetting;