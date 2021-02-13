import firebase from "firebase/app";
import { createContext, Component } from "preact";

interface AuthContextValue {
  status: "missing" | "unresolved" | "resolved";
  uid?: string;
}

export const AuthContext = createContext<AuthContextValue>({
  status: "missing"
});

export class AuthManager extends Component<{}, AuthContextValue> {
  state: AuthContextValue = {
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
