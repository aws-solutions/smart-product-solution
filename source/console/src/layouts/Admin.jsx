import React, { Component } from "react";
import { Route, Switch, Redirect } from "react-router-dom";
import NotificationSystem from "react-notification-system";
import { withAuthenticator } from "aws-amplify-react";
import Amplify from '@aws-amplify/core';
import Auth from "@aws-amplify/auth";

import routes from "routes.js";

import AdminNavbar from "components/Navbars/AdminNavbar";
import Footer from "components/Footer/Footer";
import Sidebar from "components/Sidebar/Sidebar";
import { style } from "variables/Variables.jsx";

declare var smart_product_config;
Amplify.configure(smart_product_config);

class Admin extends Component {
  constructor(props) {
    super(props);
    this.state = {
      notificationSystem: null,
      color: "black",
      fixedClasses: "dropdown show-dropdown open"
    };
  }

  // Handles Notification
  handleNotification = (message, level, iconClassName, autoDismissSecond) => {
    this.state.notificationSystem.addNotification({
      title: (<span data-notify="icon" className={iconClassName}></span>),
      message: (
        <div>{message}</div>
      ),
      level: level,
      position: 'tr',
      autoDismiss: autoDismissSecond,
    });
  };

  // Gets API token
  getToken = async () => {
    let user = await Auth.currentAuthenticatedUser();
    let token = user.signInUserSession.idToken.jwtToken;

    return token;
  };

  // Checks scroll
  isScrollBottom = () => {
    let scrollTop = document.scrollingElement.scrollTop;
    let offsetHeight = document.documentElement.offsetHeight;
    let innerHeight = window.innerHeight;

    return innerHeight + scrollTop === offsetHeight;
  };

  // Goes to the top of the page
  goTop = () => {
    document.scrollingElement.scrollTop = 0;
  };

  handleDateSize = (date) => {
    return date.substring(0, 10);
  };

  getRoutes = routes => {
    return routes.map((prop, key) => {
      if (prop.layout === "/admin") {
        return (
          <Route
            path={prop.path}
            render={props => (
              <prop.component
                {...props}
                handleNotification={this.handleNotification}
                getToken={this.getToken}
                isScrollBottom={this.isScrollBottom}
                goTop={this.goTop}
                handleDateSize={this.handleDateSize}
              />
            )}
            exact
            key={key}
          />
        );
      } else {
        return null;
      }
    });
  };
  componentDidMount() {
    this.setState({ notificationSystem: this.refs.notificationSystem });
  }
  componentDidUpdate(e) {
    if (
      window.innerWidth < 993 &&
      e.history.location.pathname !== e.location.pathname &&
      document.documentElement.className.indexOf("nav-open") !== -1
    ) {
      document.documentElement.classList.toggle("nav-open");
    }
    if (e.history.action === "PUSH") {
      document.documentElement.scrollTop = 0;
      document.scrollingElement.scrollTop = 0;
      this.refs.mainPanel.scrollTop = 0;
    }
  }
  render() {
    return (
      <div className="wrapper">
        <NotificationSystem ref="notificationSystem" style={style} />
        <Sidebar {...this.props} routes={routes} color={this.state.color} />
        <div id="main-panel" className="main-panel" ref="mainPanel">
          <AdminNavbar
            {...this.props}
            handleNotification={this.handleNotification}
            getToken={this.getToken}
          />
          <Switch>
            {this.getRoutes(routes)}
            <Redirect to="/devices" />
          </Switch>
          <Footer />
        </div>
      </div>
    );
  }
}

export default withAuthenticator(Admin);
