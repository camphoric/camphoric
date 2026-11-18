/**
 * The phone widget's country picker (SPEC §9.1, DR-175): the
 * `countrySelectComponent` `react-phone-number-input` renders, built on
 * Mantine's Combobox. Closed, it's a compact button with the country's flag and
 * dial code (`+44`); open, a list of every country, with flags, names and dial
 * codes, that a search narrows by name, two-letter code or dial code.
 *
 * The library hands it the countries as `options` (`{ value: 'GB', label:
 * 'United Kingdom' }`, an "International" option with no value) and takes the
 * choice back through `onChange`, undefined for International.
 */

import { Combobox, Group, Image, InputBase, Text, useCombobox } from '@mantine/core';
import { getCountryCallingCode, isSupportedCountry } from 'libphonenumber-js';
import { useState } from 'react';

import { flagUrl } from './phoneFlags';

/** The `<option>` value the library's own select uses for International. */
const INTERNATIONAL = 'ZZ';

export interface CountryOption {
  value?: string;
  label: string;
  divider?: boolean;
}

export interface PhoneCountryPickerProps {
  value?: string;
  options: CountryOption[];
  onChange: (country: string | undefined) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  'aria-label'?: string;
}

/** `+44` for `GB`; '' for International or a country libphonenumber lacks. */
function dialCode(country: string | undefined): string {
  return country && isSupportedCountry(country) ? `+${getCountryCallingCode(country)}` : '';
}

function Flag({ country }: { country: string | undefined }) {
  const src = flagUrl(country);
  // International has no flag: a globe stands in.
  if (!src) return <Text span aria-hidden>🌐</Text>;
  return <Image src={src} alt="" w={20} h={14} radius={2} fit="cover" />;
}

/** Whether an option matches the search text: its name, code or dial code. */
function matches(option: CountryOption, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const code = dialCode(option.value);
  return (
    option.label.toLowerCase().includes(query) ||
    (option.value ?? '').toLowerCase() === query ||
    (query.replace(/^\+?/, '+') === code && code !== '')
  );
}

export function PhoneCountryPicker({
  value,
  options,
  onChange,
  onFocus,
  onBlur,
  disabled,
  readOnly,
  'aria-label': ariaLabel = 'Country',
}: PhoneCountryPickerProps) {
  const [search, setSearch] = useState('');
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setSearch('');
    },
    onDropdownOpen: () => combobox.focusSearchInput(),
  });

  const selected = options.find((option) => !option.divider && option.value === value);
  const shown = options.filter((option) => !option.divider && matches(option, search));

  return (
    <Combobox
      store={combobox}
      width={300}
      position="bottom-start"
      onOptionSubmit={(choice) => {
        onChange(choice === INTERNATIONAL ? undefined : choice);
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          component="button"
          type="button"
          pointer
          aria-label={`${ariaLabel}: ${selected?.label ?? 'International'}`}
          aria-haspopup="listbox"
          disabled={disabled || readOnly}
          leftSection={<Flag country={value} />}
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
          onClick={() => combobox.toggleDropdown()}
          onFocus={onFocus}
          onBlur={onBlur}
          w="6.5rem"
          data-country={value ?? INTERNATIONAL}
        >
          {dialCode(value)}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Search countries"
          aria-label="Search countries"
        />
        <Combobox.Options mah={260} style={{ overflowY: 'auto' }}>
          {shown.length === 0 ? (
            <Combobox.Empty>No country matches</Combobox.Empty>
          ) : (
            shown.map((option) => (
              <Combobox.Option
                key={option.value ?? INTERNATIONAL}
                value={option.value ?? INTERNATIONAL}
                active={option.value === value}
              >
                <Group gap="xs" wrap="nowrap">
                  <Flag country={option.value} />
                  <Text size="sm" style={{ flex: 1 }}>
                    {option.label}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {dialCode(option.value)}
                  </Text>
                </Group>
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
