import {
  createPortal,
  FunctionComponent,
  useLayoutEffect
} from "preact/compat";
import { Icon } from "./icon";
import { X } from "preact-feather";
import styles from "./modal.css";

const modalRoot = document.createElement("div");
// modalRoot.className = styles.modalRoot;
document.body.appendChild(modalRoot);

interface Props {
  onClose?: () => void;
}

export const Modal: FunctionComponent<Props> = ({ children, onClose }) => {
  useLayoutEffect(() => {
    function escapeHandler(e: KeyboardEvent) {
      if (e.keyCode === 27 && !e.defaultPrevented && onClose) {
        onClose();
      }
    }

    document.addEventListener("keyup", escapeHandler);
    return () => {
      document.removeEventListener("keyup", escapeHandler);
    };
  }, [onClose]);

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
};
