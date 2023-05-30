import { ControlGroup, InputGroup, Button } from "@blueprintjs/core";
import { InputHTMLAttributes, ReactNode, useRef } from "react";

interface Props {
  placeholder?: string;
  value?: string;
  rightElement?: JSX.Element;
  disableInput?: boolean;
  disableButton?: boolean;
  /** called when the user clicks the button or presses the enter key */
  onClick(value: string, element: HTMLInputElement): void;
  buttonLabel: ReactNode;
  enterKeyHint?: InputHTMLAttributes<unknown>["enterKeyHint"];
}

export function InputButtonPair(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleClick = () =>
    props.onClick(inputRef.current!.value, inputRef.current!);
  return (
    <ControlGroup>
      <InputGroup
        readOnly={props.disableInput}
        inputRef={inputRef}
        placeholder={props.placeholder}
        value={props.value}
        rightElement={props.rightElement}
        onKeyDown={(e) => {
          if (e.code === "Enter") {
            handleClick();
          }
        }}
        enterKeyHint={props.enterKeyHint}
      />
      <Button disabled={props.disableButton} onClick={handleClick}>
        {props.buttonLabel}
      </Button>
    </ControlGroup>
  );
}
