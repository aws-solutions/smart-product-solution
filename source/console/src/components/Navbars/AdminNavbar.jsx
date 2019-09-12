import React, { Component } from "react";
import { Navbar } from "react-bootstrap";

import AdminNavbarLinks from "./AdminNavbarLinks.jsx";

class Header extends Component {
  constructor(props) {
    super(props);
    this.mobileSidebarToggle = this.mobileSidebarToggle.bind(this);
    this.state = {
      sidebarExists: false
    };
  }
  mobileSidebarToggle(e) {
    if (this.state.sidebarExists === false) {
      this.setState({
        sidebarExists: true
      });
    }
    e.preventDefault();
    document.documentElement.classList.toggle("nav-open");
    var node = document.createElement("div");
    node.id = "bodyClick";
    node.onclick = function () {
      this.parentElement.removeChild(this);
      document.documentElement.classList.toggle("nav-open");
    };
    document.body.appendChild(node);
  }
  render() {
    return (
      <Navbar fluid>
        <Navbar.Header>
          <Navbar.Toggle onClick={this.mobileSidebarToggle} />
        </Navbar.Header>
        <Navbar.Collapse>
          <AdminNavbarLinks 
            {...this.props}
            handleNotification={this.props.handleNotification}
            getToken={this.props.getToken}
          />
        </Navbar.Collapse>
      </Navbar>
    );
  }
}

export default Header;
