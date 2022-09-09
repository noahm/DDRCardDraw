import { App } from "./app";
import { createRoot } from "react-dom/client";
import styles from "./app.css";
const appRoot = document.createElement("main");
document.body.prepend(appRoot);
appRoot.className = styles.container;
const root = createRoot(appRoot);
root.render(<App />);
