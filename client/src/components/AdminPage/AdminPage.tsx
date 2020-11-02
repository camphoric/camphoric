import React from "react";

type AdminPageProps = {
  authToken?: string,
};

class AdminPage extends React.Component<AdminPageProps> {
  render() {
    return <div>admin interface - {this.props.authToken} </div>;
  }
}

export default AdminPage;
