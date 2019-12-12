import { createPortal } from "preact/compat";
import { Icon } from "./icon";
import { X } from "preact-feather";
import styles from "./modal.css";

const modalRoot = document.createElement("div");
// modalRoot.className = styles.modalRoot;
document.body.appendChild(modalRoot);

/**
 * @param {=(e: MouseEvent) => void} props.onClose pass if you want the default close button
 */
export function Modal({ children, onClose }) {
  return createPortal(
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContents}>
        {onClose && (
          <Icon
            svg={<X />}
            title="Close"
            className={styles.close}
            onClick={onClose}
          />
        )}
        {children}
      </div>
    </div>,
    modalRoot
  );
}
