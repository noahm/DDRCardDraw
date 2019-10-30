import * as firebase from "firebase/app";
import { useContext } from "preact/hooks";
import { AuthContext } from "./auth";
import { Text } from "preact-i18n";

function login() {
  firebase
    .auth()
    .signInAnonymously()
    .catch(error => {
      console.log(error);
    });
}

function logout() {
  firebase
    .auth()
    .signOut()
    .catch(error => {
      console.log(error);
    });
}

export function AuthButton() {
  const auth = useContext(AuthContext);
  if (auth.status !== "resolved") {
    return null;
  }

  if (auth.uid) {
    return (
      <button onClick={logout}>
        <Text id="logout">Logout</Text> {auth.uid}
      </button>
    );
  } else {
    return (
      <button onClick={login}>
        <Text id="login">Login</Text>
      </button>
    );
  }
}
