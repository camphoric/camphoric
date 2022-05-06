import React from 'react';
import {
  UserContext,
  UserInfo,
} from './user';

type State = {
  user: {
    set: (value: UserInfo) => void,
    value: UserInfo,
  },
}

type Props = {
  initialUser: UserInfo,
}

export default class StateProvider extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      user: {
        set: this.setUser,
        value: this.props.initialUser,
      },
    };
  }

  setUser = (value: UserInfo) => {
    const user = {
      set: this.setUser,
      value,
    };

    this.setState({ user });
  }

  render() {
    return (
      <UserContext.Provider value={this.state.user}>
        {this.props.children}
      </UserContext.Provider>
    );
  }
}
