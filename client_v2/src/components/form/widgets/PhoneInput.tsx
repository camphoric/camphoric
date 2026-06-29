/**
 * International phone-number widget (SPEC §9.1, DR-30). The @rjsf/mantine base
 * theme has no phone input, so this builds a Mantine-native one with
 * `react-international-phone`'s `usePhoneInput` hook: a Mantine `TextInput`
 * whose `leftSection` is the library's flag country selector. The hook formats
 * as the user types and reports the value in E.164 form; default country is US.
 */

import 'react-international-phone/style.css';

import { TextInput } from '@mantine/core';
import type { WidgetProps } from '@rjsf/utils';
import { CountrySelector, usePhoneInput } from 'react-international-phone';

interface PhoneOptions {
  emptyValue?: unknown;
}

export function PhoneInput(props: WidgetProps) {
  const { id, onChange, onBlur, onFocus, label, required, disabled, readonly } = props;
  const value = props.value as string | undefined;
  const options = props.options as PhoneOptions;
  const error = props.rawErrors && props.rawErrors.length > 0 ? props.rawErrors.join('\n') : undefined;
  const isDisabled = disabled || readonly;

  const { inputValue, country, setCountry, handlePhoneValueChange, inputRef } = usePhoneInput({
    defaultCountry: 'us',
    value: value ?? '',
    onChange: ({ phone }) => onChange(phone ? phone : options.emptyValue),
  });

  return (
    <TextInput
      id={id}
      ref={inputRef}
      type="tel"
      label={label || undefined}
      required={required}
      error={error}
      disabled={isDisabled}
      value={inputValue}
      onChange={handlePhoneValueChange}
      onBlur={() => onBlur(id, value)}
      onFocus={() => onFocus(id, value)}
      leftSectionWidth={68}
      leftSectionPointerEvents="all"
      leftSection={
        <CountrySelector
          selectedCountry={country.iso2}
          onSelect={(selected) => setCountry(selected.iso2)}
          disabled={isDisabled}
          buttonStyle={{ border: 'none', background: 'transparent', height: '100%' }}
        />
      }
    />
  );
}
