/**
 * International phone-number widget (SPEC §9.1, DR-30). The @rjsf/mantine base
 * theme has no phone input, so this builds a Mantine-native one with
 * `react-international-phone`'s `usePhoneInput` hook: a Mantine `TextInput`
 * whose `leftSection` is the library's flag country selector. The hook formats
 * as the user types and reports the value in E.164 form; default country is US.
 * WidgetFrame supplies the label and description.
 *
 * The hook reads every value as international (`+` and a country code). Browser
 * autofill and paste replace the whole value at once, often with a national
 * number (`(202) 555-1234`), dropping the `+1` the field starts with; the hook
 * would then read `20…` as Egypt. So a value without a leading `+` is read as a
 * number in the selected country (`nationalToInternational`). One with a `+` and
 * another country code still switches the country.
 *
 * The hook also drops any typed-in text that isn't all digits, to keep letters
 * out — including a whole number inserted in one go (`+1 (202) 555-1234`), as
 * some autofill does. So a value that arrives all at once doesn't go through
 * the hook's handler: the widget reports it in E.164 form, and the hook, which
 * follows its `value`, formats it and picks its country.
 */

import 'react-international-phone/style.css';

import { TextInput } from '@mantine/core';
import type { WidgetProps } from '@rjsf/utils';
import type { ChangeEvent } from 'react';
import { CountrySelector, usePhoneInput } from 'react-international-phone';

import { WidgetFrame } from './WidgetFrame';
import { widgetCommon } from './widgetProps';

/**
 * A phone value as the hook expects it: international, with a leading `+`. One
 * without is a national number in the country with `dialCode`, except that a
 * North American number starting with 1 already gives its country code (no
 * area code there starts with 1). Empty stays empty.
 */
export function nationalToInternational(value: string, dialCode: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.startsWith('+')) return value;
  const digits = trimmed.replace(/\D/g, '');
  if (digits === '') return value;
  if (dialCode === '1' && digits.startsWith('1')) return `+${digits}`;
  return `+${dialCode}${digits}`;
}

/** A phone value in E.164 form (`+` and its digits), or '' when it has none. */
function toE164(international: string): string {
  const digits = international.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

/**
 * Whether a change set the value all at once (autofill, paste, a password
 * manager), not one typed character, a deletion or an undo, which the hook
 * handles itself.
 */
function isWholeValueChange(event: Event): boolean {
  const { inputType = '', data = null } = event as Partial<InputEvent>;
  if (inputType.startsWith('delete') || inputType.startsWith('history')) return false;
  return !(inputType === 'insertText' && (data ?? '').length <= 1);
}

export function PhoneInput(props: WidgetProps) {
  const { id, required, disabled, error, value, options } = widgetCommon<string>(props);
  const { onChange, onBlur, onFocus } = props;

  const { inputValue, country, setCountry, handlePhoneValueChange, inputRef } = usePhoneInput({
    defaultCountry: 'us',
    value: value ?? '',
    onChange: ({ phone }) => onChange(phone || options.emptyValue),
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const international = nationalToInternational(event.target.value, country.dialCode);
    if (isWholeValueChange(event.nativeEvent)) {
      onChange(toE164(international) || options.emptyValue);
      return;
    }
    // Only rewrite a value that needs it, so typing keeps the cursor where it is.
    if (international !== event.target.value) event.target.value = international;
    handlePhoneValueChange(event);
  };

  return (
    <WidgetFrame {...props}>
      <TextInput
        id={id}
        ref={inputRef}
        type="tel"
        autoComplete="tel"
        required={required}
        error={error}
        disabled={disabled}
        value={inputValue}
        onChange={handleChange}
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
