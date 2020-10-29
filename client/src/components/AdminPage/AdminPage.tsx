import "bootstrap/dist/css/bootstrap.min.css";

import React from "react";

import "./AdminPage.css";

type AdminPageProps = {
  authToken?: string,
};

class AdminPage extends React.Component<AdminPageProps> {
  render() {
    return <div className="AdminPage">admin interface - {this.props.authToken} </div>;
  }
}

export default AdminPage;
