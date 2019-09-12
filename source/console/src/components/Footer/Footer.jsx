import React, { Component } from "react";
import { Grid } from "react-bootstrap";

class Footer extends Component {
  render() {
    return (
      <footer className="footer">
        <Grid fluid>
          <nav className="pull-left">
          </nav>
          <p className="copyright pull-right">
            &copy; {new Date().getFullYear()}{" "}
            <a href="https://aws.amazon.com/solutions" target="_blank" rel="noopener noreferrer">
              AWS Solutions
            </a>
          </p>
        </Grid>
      </footer>
    );
  }
}

export default Footer;
