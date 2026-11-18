/**
 * International phone-number widget (SPEC §9.1, DR-175). The @rjsf/mantine base
 * theme has no phone input, so this builds a Mantine-native one on
 * `react-phone-number-input` (on Google's phone metadata, via
 * `libphonenumber-js`): a country picker (PhoneCountryPicker) beside a Mantine
 * `TextInput`, which the library formats as the user types, keeping the cursor
 * in place. The value is reported in E.164 form (`+12025551234`), or as the
 * field's `emptyValue` when there's no number.
 *
 * A number without a leading `+` is a number in the selected country, read by
 * that country's own rules: `(202) 555-1234` in the US and `020 7946 0958` in
 * the UK (dropping its leading 0) alike. That's also how browser autofill and
 * paste are read, which often give a national number. A number with `+` and a
 * country code switches the country to match. The selected country starts as
 * the field's `ui:options.defaultCountry` (a two-letter code, `GB`), else the US.
 *
 * A number dialled with the selected country's exit code (`011 44 20 7946 0958`
 * in the US) is the number it dials, `+442079460958`: the library alone would
 * read it as a national number. A saved value that isn't in E.164 form (from an
 * import, say) is shown as a number in the field's starting country, and saved
 * in E.164 form once it's edited.
 *
 * A dial code alone (`+44`) isn't an answer: it's reported as the field's
 * `emptyValue`, so a required phone number with nothing more is rejected as
 * missing (#986), while the field keeps showing what was typed.
 *
 * WidgetFrame supplies the label and description.
 */

import { Group, TextInput } from '@mantine/core';
import type { WidgetProps } from '@rjsf/utils';
import {
  type CountryCode as Country,
  isSupportedCountry,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import {
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
  useRef,
  useState,
} from 'react';
import PhoneNumberInput from 'react-phone-number-input';

import { dialCodeOf, mainCountry } from '../phoneNumber';
import { PhoneCountryPicker } from './PhoneCountryPicker';
import { linkToFrame, WidgetFrame } from './WidgetFrame';
import { widgetCommon } from './widgetProps';

/** The country a phone field starts in when its uiSchema names none. */
export const DEFAULT_PHONE_COUNTRY: Country = 'US';

/** A field's starting country: `ui:options.defaultCountry` when it's one we know. */
export function phoneDefaultCountry(option: unknown): Country {
  const code = typeof option === 'string' ? option.trim().toUpperCase() : '';
  return isSupportedCountry(code) ? code : DEFAULT_PHONE_COUNTRY;
}

/**
 * The value the library takes for a saved answer: the answer itself in E.164
 * form; one in another form read as a number in `country`; else nothing.
 */
export function savedNumber(value: unknown, country: Country): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  if (/^\+\d+$/.test(value)) return value;
  return parsePhoneNumberFromString(value, country)?.number;
}

/**
 * The answer the library's report gives, with what's typed in the field
 * (`typed`): none for a dial code alone. The library reads a number dialled
 * with the country's exit code as a national one, so a number typed without a
 * `+` is also read by Google's rules for the country it was typed in (the
 * report's dial code's main country), and that reading is the answer when it
 * dials another country (`011 44 20 7946 0958` typed in the US is
 * `+442079460958`, not `+12079460958`). Otherwise the library's reading stands.
 */
export function phoneAnswer(reported: string | undefined, typed?: string): string | undefined {
  if (!reported || mainCountry(reported.slice(1))) return undefined;
  const code = dialCodeOf(reported);
  if (!typed || typed.trim().startsWith('+') || !code) return reported;
  const dialled = parsePhoneNumberFromString(typed, mainCountry(code))?.number;
  // Only another country's number: within the country, Google's parser keeps a
  // trunk 0 the library drops (`0207946` in the UK as `+440207946`), which can
  // make a number cut short look whole.
  return dialled && dialCodeOf(dialled) !== code ? dialled : reported;
}

/** The two controls side by side, the number taking the width. */
function PhoneContainer({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Group className={className} style={style} gap="xs" wrap="nowrap" align="flex-start">
      {children}
    </Group>
  );
}

type NumberTextInputProps = Omit<ComponentPropsWithRef<'input'>, 'size'> & {
  error?: string;
  inputContainer?: (control: ReactNode) => ReactNode;
};

/** The number's Mantine input, which the library formats. */
function NumberTextInput({ className: _library, error, inputContainer, ...rest }: NumberTextInputProps) {
  return (
    <TextInput {...rest} error={error} inputContainer={inputContainer} style={{ flex: 1, minWidth: 0 }} />
  );
}

export function PhoneInput(props: WidgetProps) {
  const { id, required, disabled, error, value, options } = widgetCommon<string>(props);
  const { onChange, onBlur, onFocus } = props;
  const defaultCountry = phoneDefaultCountry(options.defaultCountry);
  const input = useRef<HTMLInputElement>(null);
  // The library takes a `value` it didn't report itself as set from outside,
  // and starts over from it. So while the form holds the answer the library's
  // last report gave (none, for `+44`; another number, for an exit code), hand
  // the library that report back.
  const [last, setLast] = useState<{ reported?: string; answer?: string }>({});
  const saved = savedNumber(value, defaultCountry);
  const shown = last.answer === saved ? last.reported : saved;

  return (
    <WidgetFrame {...props}>
      <PhoneNumberInput
        // The library forwards `ref` to the <input> (its types say the component).
        ref={input as never}
        value={shown}
        onChange={(next) => {
          // The library has already written its formatted text to the input.
          const answer = phoneAnswer(next, input.current?.value);
          setLast({ reported: next, answer });
          onChange(answer ?? options.emptyValue);
        }}
        defaultCountry={defaultCountry}
        initialValueFormat="national"
        countrySelectComponent={PhoneCountryPicker}
        containerComponent={PhoneContainer}
        inputComponent={NumberTextInput}
        numberInputProps={{
          id,
          error,
          required,
          inputContainer: linkToFrame(props),
        }}
        autoComplete="tel"
        disabled={disabled}
        onFocus={() => onFocus(id, value)}
        onBlur={() => onBlur(id, value)}
      />
    </WidgetFrame>
  );
}
