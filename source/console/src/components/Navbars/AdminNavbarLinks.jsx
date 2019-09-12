import React, { Component } from "react";
import {
  NavItem,
  Nav
} from "react-bootstrap";
import { Auth, Logger, API } from 'aws-amplify';

import configurations from "variables/configurations";

class AdminNavbarLinks extends Component {
  constructor(props) {
    super(props);

    this.handleSelect = this.handleSelect.bind(this);

    this.logger = new Logger(configurations.logger.name, configurations.logger.level);

    // Sets up initial state
    this.state = {
      alertsCount: '-',
      side: this.props.side
    }
  }

  componentDidMount() {
    // In case the class is called from the side bar, it will get the value from the main container.
    // The main container gets the value through the API.
    if (this.state.side) {
      this.setState({ 
        alertsCount: document.getElementById('notification-count').innerText
      });
      this.timer = setInterval(() => {
        this.setState({ 
          alertsCount: document.getElementById('notification-count').innerText
        });
      }, 10000);  // Gets alerts every 10 seconds from the main container
    } else {
      this.getAlertsCount();
      this.timer = setInterval(async() => {
        await this.getAlertsCount();
      }, 300000);  // Gets alerts every 5 minute  
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  // Handles menu select
  handleSelect(eventKey) {
    if (eventKey === 'logout') {
        Auth.signOut()
        .then(data => this.logger.debug("Logged out"))
        .catch(err => this.logger.error(err));
    } else if (eventKey === 'alerts') {
      this.props.history.push('/alerts');
    }
  }

  // Gets alerts count
  getAlertsCount = async () => {
    let token = await this.props.getToken();
    let apiName = 'smart-product-api';
    let path = 'devices/alerts/count';
    let params = {
      headers: {
        'Authorization': token,
      },
      response: false,
    };

    API.get(apiName, path, params)
      .then(response => {
        this.setState({ alertsCount: response.alertsCount });
        if (response.alertsCount > 0) {
          let message = `You have ${this.state.alertsCount} new alerts.`;
          this.props.handleNotification(message, 'warning', 'pe-7s-bell', 10);
        }
      })
      .catch(error => {
        this.props.handleNotification('An error occurred while getting the count of alerts', 'error', 'pe-7s-close-circle', 10);
      });
  }

  render() {
    return (
      <div>
        <Nav pullRight onSelect={k => this.handleSelect(k)}>
          <NavItem eventKey={'alerts'} href="/alerts">
            <i className="fa pe-7s-bell" />
            <span className="notification" id={!this.state.side ? "notification-count" : "side-notification-count"}>
              { this.state.alertsCount }
            </span>
            <p className="hidden-lg hidden-md">Alerts</p>
          </NavItem>
          <NavItem eventKey={'logout'} href="#">
            Log out
          </NavItem>
        </Nav>
      </div>
    );
  }
}

export default AdminNavbarLinks;
