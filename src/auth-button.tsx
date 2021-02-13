import firebase from "firebase/app";
import { useContext } from "preact/hooks";
import { AuthContext } from "./auth";
import { TranslateContext } from "@denysvuika/preact-translate";

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
  const { t } = useContext(TranslateContext);

  if (auth.status !== "resolved") {
    return null;
  }

  if (auth.uid) {
    return (
      <button onClick={logout}>
        {t("logout")} {auth.uid}
      </button>
    );
  } else {
    return <button onClick={login}>{t("login")}</button>;
  }
}
