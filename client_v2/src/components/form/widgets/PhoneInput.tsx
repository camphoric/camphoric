/**
 * International phone-number widget (SPEC §9.1, DR-30). The @rjsf/mantine base
 * theme has no phone input, so this builds a Mantine-native one with
 * `react-international-phone`'s `usePhoneInput` hook: a Mantine `TextInput`
 * whose `leftSection` is the library's flag country selector. The hook formats
 * as the user types and reports the value in E.164 form; default country is US.
 * WidgetFrame supplies the label and description.
 */

import 'react-international-phone/style.css';

import { TextInput } from '@mantine/core';
import type { WidgetProps } from '@rjsf/utils';
import { CountrySelector, usePhoneInput } from 'react-international-phone';

import { WidgetFrame } from './WidgetFrame';
import { widgetCommon } from './widgetProps';

export function PhoneInput(props: WidgetProps) {
  const { id, required, disabled, error, value, options } = widgetCommon<string>(props);
  const { onChange, onBlur, onFocus } = props;

  const { inputValue, country, setCountry, handlePhoneValueChange, inputRef } = usePhoneInput({
    defaultCountry: 'us',
    value: value ?? '',
    onChange: ({ phone }) => onChange(phone || options.emptyValue),
  });

  return (
    <WidgetFrame {...props}>
      <TextInput
        id={id}
        ref={inputRef}
        type="tel"
        required={required}
        error={error}
        disabled={disabled}
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
            disabled={disabled}
            buttonStyle={{ border: 'none', background: 'transparent', height: '100%' }}
          />
        }
      />
    </WidgetFrame>
  );
}
