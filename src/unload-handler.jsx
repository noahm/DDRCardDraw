import { Component } from "preact";
import { withText } from "preact-i18n";

class UnloadHandlerImpl extends Component {
  componentDidMount() {
    window.addEventListener("beforeunload", this.handleUnload);
  }

  componentWillUnmount() {
    window.removeEventListener("beforeunload", this.handleUnload);
  }

  handleUnload = e => {
    if (this.props.confirmUnload) {
      e.returnValue = this.props.confirmText;
    }
  };
}

export const UnloadHandler = withText({ confirmText: "confirmClose" })(
  UnloadHandlerImpl
);
