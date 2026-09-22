import { Button, Group, TextInput } from "@mantine/core";
import {
  InputHTMLAttributes,
  JSX,
  ReactNode,
  useCallback,
  useRef,
} from "react";

interface Props {
  placeholder?: string;
  value?: string;
  rightElement?: JSX.Element;
  disableInput?: boolean;
  disableButton?: boolean;
  /** called when the user clicks the button or presses the enter key */
  onClick(this: void, value: string, element: HTMLInputElement): void;
  buttonLabel: ReactNode;
  enterKeyHint?: InputHTMLAttributes<unknown>["enterKeyHint"];
}

export function InputButtonPair({ onClick, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleClick = useCallback(() => {
    const el = inputRef.current!;
    return onClick(el.value, el);
  }, [onClick]);
  return (
    <Group gap={4} wrap="nowrap">
      <TextInput
        readOnly={props.disableInput}
        ref={inputRef}
        placeholder={props.placeholder}
        value={props.value}
        rightSection={props.rightElement}
        onKeyDown={(e) => {
          if (e.code === "Enter") {
            handleClick();
          }
        }}
        enterKeyHint={props.enterKeyHint}
      />
      <Button
        variant="default"
        disabled={props.disableButton}
        onClick={handleClick}
      >
        {props.buttonLabel}
      </Button>
    </Group>
  );
}
