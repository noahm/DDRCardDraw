import * as firebase from "firebase/app";
import { createContext, Component } from "preact";

export const AuthContext = createContext({ status: "missing" });

export class AuthManager extends Component {
  state = {
    status: "unresolved",
    uid: undefined
  };

  componentDidMount() {
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        this.setState({
          status: "resolved",
          uid: user.uid
        });
      } else {
        this.setState({
          status: "resolved",
          uid: undefined
        });
      }
    });
  }

  render() {
    return (
      <AuthContext.Provider value={this.state}>
        {this.props.children}
      </AuthContext.Provider>
    );
  }
}
