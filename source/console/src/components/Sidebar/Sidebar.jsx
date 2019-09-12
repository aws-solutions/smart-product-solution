import React, { Component } from "react";
import { NavLink } from "react-router-dom";

import AdminNavbarLinks from "../Navbars/AdminNavbarLinks.jsx";
import logo from "assets/img/logo-aws.png";

class Sidebar extends Component {
  constructor(props) {
    super(props);
    this.state = {
      width: window.innerWidth
    };
  }
  activeRoute(routeName) {
    return this.props.location.pathname.indexOf(routeName) > -1 ? "active" : "";
  }
  updateDimensions() {
    this.setState({ width: window.innerWidth });
  }
  componentDidMount() {
    this.updateDimensions();
    window.addEventListener("resize", this.updateDimensions.bind(this));
  }
  render() {
    return (
      <div
        id="sidebar"
        className="sidebar"
        data-color={this.props.color}
      >
        <div className="logo">
          <div className="logo-mini logo-img">
            <img src={logo} alt="logo_image" />
          </div>
          <div className="simple-text logo-normal">
            Smart Product
          </div>
        </div>
        <div className="sidebar-wrapper">
          <ul className="nav">
            {this.state.width <= 991 ? <AdminNavbarLinks side={true} /> : null}
            {this.props.routes.map((prop, key) => {
              if (!prop.redirect && prop.visible)
                return (
                  <li className={this.activeRoute(prop.path)} key={key}>
                    <NavLink to={prop.path} className="nav-link" activeClassName="active">
                      <i className={prop.icon} />
                      <p>{prop.name}</p>
                    </NavLink>
                  </li>
                );
              return null;
            })}
          </ul>
        </div>
      </div>
    );
  }
}

export default Sidebar;
