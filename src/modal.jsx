import { createPortal } from "preact/compat";
import styles from "./modal.css";

const modalRoot = document.createElement("div");
modalRoot.className = styles.modalRoot;
document.body.appendChild(modalRoot);

export function Modal({ children }) {
  return createPortal(
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContents}>{children}</div>
    </div>,
    modalRoot
  );
}
