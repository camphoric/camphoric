/**
 * Address field (SPEC §9.1) — a composite of street/city/state/zip plus an
 * optional country select. When a Google Maps API key is configured, the street
 * field is a Google Places (New) autocomplete that, on selection, populates all
 * sub-fields atomically and suppresses Enter-to-submit (DR-23); with no key it
 * is a plain text input. Referenced from an event's uiSchema as
 * `ui:field: 'Address'`.
 */

import { Input, Select, Stack, TextInput, Title } from '@mantine/core';
import type { FieldProps, RJSFSchema } from '@rjsf/utils';
import { type ChangeEvent, useEffect, useRef } from 'react';

import { mountPlaceAutocomplete, type ParsedAddress } from './googlePlaces';

const TEXT_SUBFIELDS = [
  { key: 'city', label: 'City' },
  { key: 'state_or_province', label: 'State / Province' },
  { key: 'zip_code', label: 'ZIP / Postal code' },
] as const;

type AddressValue = ParsedAddress;

interface CountrySchema {
  title?: string;
  enum?: string[];
  default?: string;
}

const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export function Address(props: FieldProps) {
  const value = (props.formData ?? {}) as AddressValue;
  const schemaProperties = (props.schema.properties ?? {}) as Record<string, RJSFSchema>;
  const requiredKeys = props.schema.required ?? [];
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const useGoogle = Boolean(googleApiKey);

  const change = (patch: Partial<AddressValue>) =>
    props.onChange({ ...value, ...patch }, props.fieldPathId.path);

  const setField = (key: keyof AddressValue) => (event: ChangeEvent<HTMLInputElement>) =>
    change({ [key]: event.currentTarget.value || undefined });

  // Mount the Google autocomplete once; it reports the whole address on select.
  useEffect(() => {
    if (!useGoogle || !googleApiKey || !autocompleteRef.current) return;
    return mountPlaceAutocomplete(autocompleteRef.current, googleApiKey, (address) =>
      props.onChange(address, props.fieldPathId.path),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const labelFor = (key: string, fallback: string) =>
    (schemaProperties[key]?.title) ?? fallback;
  const isRequired = (key: string) => requiredKeys.includes(key);
  const countrySchema = schemaProperties.country as CountrySchema | undefined;

  return (
    <Stack className="address" gap="sm" id={props.fieldPathId.$id}>
      {props.schema.title && <Title order={5}>{props.schema.title}</Title>}

      {useGoogle ? (
        <Input.Wrapper
          label={labelFor('street_address', 'Street address')}
          required={isRequired('street_address')}
        >
          <div ref={autocompleteRef} />
        </Input.Wrapper>
      ) : (
        <TextInput
          label={labelFor('street_address', 'Street address')}
          required={isRequired('street_address')}
          value={value.street_address ?? ''}
          onChange={setField('street_address')}
        />
      )}

      {TEXT_SUBFIELDS.map(({ key, label }) => (
        <TextInput
          key={key}
          label={labelFor(key, label)}
          required={isRequired(key)}
          value={value[key] ?? ''}
          onChange={setField(key)}
        />
      ))}

      {countrySchema?.enum && (
        <Select
          label={countrySchema.title ?? 'Country'}
          required={isRequired('country')}
          data={countrySchema.enum}
          value={value.country ?? countrySchema.default ?? null}
          onChange={(next) => change({ country: next ?? undefined })}
        />
      )}
    </Stack>
  );
}
