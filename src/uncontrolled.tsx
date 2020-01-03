import { useState } from "preact/hooks";
import { JSXInternal } from "preact/src/jsx";

interface CheckboxProps extends JSXInternal.HTMLAttributes<HTMLInputElement> {
  defaultChecked?: boolean;
  onChange?: (e: JSXInternal.TargetedEvent<HTMLInputElement>) => void;
}

/**
 * This file exists because Preact doesn't handle uncontrolled inputs
 * with default values correctly. These components can be used as a
 * stand-in for uncontrolled inputs and checkboxes that need a specific
 * default value at initial mount.
 */
export function UncontrolledCheckbox(props: CheckboxProps) {
  const { defaultChecked, onChange, ...otherProps } = props;
  const [checked, updateChecked] = useState(defaultChecked);
  return (
    <input
      {...otherProps}
      type="checkbox"
      checked={checked}
      onChange={e => {
        updateChecked(!!e.currentTarget.checked);
        if (onChange) {
          onChange(e);
        }
      }}
    />
  );
}

interface InputProps extends JSXInternal.HTMLAttributes<HTMLInputElement> {
  defaultValue?: string;
  onChange?: (e: JSXInternal.TargetedEvent<HTMLInputElement>) => void;
}

export function UncontrolledInput(props: InputProps) {
  const { defaultValue, onChange, ...otherProps } = props;
  const [value, updateValue] = useState(defaultValue);
  return (
    <input
      {...otherProps}
      value={value}
      onChange={e => {
        updateValue(e.currentTarget.value);
        if (onChange) {
          onChange(e);
        }
      }}
    />
  );
}
