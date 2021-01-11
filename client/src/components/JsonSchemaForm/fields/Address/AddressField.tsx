import React from 'react';
import Form from 'react-bootstrap/Form';
import { Keys, FormData, Props } from './index';

interface AddressProps extends Props {
  name: Keys;
  idBase: string;
  value?: string;
  onChange: (evt: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeWholeAddress: (address: FormData) => void;
}

function AddressField (props: AddressProps) {
  const rawErrors = props.rawErrors || [];
  const classes = [
    props.name,
    (rawErrors.length ? 'is-invalid' : ''),
  ].filter(Boolean).join(' ');

  const required = props.schema.required && props.schema.required.includes(props.name);

  const properties = props.schema.properties &&
    props.schema.properties[props.name];

  const label = typeof properties === 'boolean' ? props.name : properties?.title;

  let InputControl: Function = Form.Control;
  let otherProps = {};

  if (props.name === 'street_address' && process.env.REACT_APP_GOOGLE_API_KEY) {
    InputControl = StreetAddressFieldInput;
    otherProps = {
      onChangeWholeAddress: props.onChangeWholeAddress,
    };
  }

  return (
    <Form.Group className={`${props.name} mb-0`}>
      <Form.Label className={rawErrors.length > 0 ? 'text-danger' : ''}>
        {label}{label && props.required ? "*" : null}
      </Form.Label>
      <InputControl
        id={`${props.idBase}__${props.name}`}
        required={required}
        className={classes}
        type={props.type || (props.schema.type as string)}
        value={props.value || ''}
        onChange={props.onChange}
        {...otherProps}
      />
    </Form.Group>
  );
}

// [Enter] should not submit the form when choosing an address.
function noopEnter(id: string) {
  const node = document.getElementById(id) as HTMLInputElement;

  const addEvent = node.addEventListener;
  addEvent('keypress', (event) => {
    if (event.keyCode === 13) {
      event.preventDefault();
    }
  }, false);
}

function initAutocomplete(id: string, onSelect: Function) {
  if (!window.google) return;

  // [Enter] should not submit the form when choosing an address.
  noopEnter(id);

  // Create the autocomplete object, restricting the search predictions to
  // geographical location types.
  const autocomplete = new window.google.maps.places.Autocomplete(
    document.getElementById(id) as HTMLInputElement,
    { types: ["geocode"] }
  );

  // Avoid paying for data that you don't need by restricting the set of
  // place fields that are returned to just the address components.
  autocomplete.setFields(['address_component']);

  // When the user selects an address from the drop-down, populate the
  // address fields in the form.
  autocomplete.addListener('place_changed', () => onSelect(autocomplete.getPlace()));

  return autocomplete;
}

interface StreetAddressFieldInputProps {
  required?: boolean;
  className: string;
  id: string;
  type: string;
  value: string;
  onChange: (evt: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeWholeAddress: (address: FormData) => void;
}

function StreetAddressFieldInput({ id, onChangeWholeAddress, ...props }: StreetAddressFieldInputProps) {
  React.useEffect(() => {
    initAutocomplete(id, function (value: google.maps.places.PlaceResult) {
      // lookup the address parts for this address string
      // use onChangeWholeAddress to set the whole address
      const { address_components } = value;

      if (!address_components) return;

      const addressParts: { [key: string]: string } = {};

      address_components.forEach((comp) => {
        comp.types.forEach(t => {
          addressParts[t] = comp.long_name;
        });
      });

      const data = {
        'street_address': [
          addressParts.street_number,
          addressParts.route,
        ].filter(Boolean).join(' '),
        'city': addressParts.locality,
        'state_or_province': addressParts.administrative_area_level_1,
        'zip_code': [
          addressParts.postal_code,
          addressParts.postal_code_suffix,
        ].filter(Boolean).join('-'),
        'country': addressParts.country,
      };

      onChangeWholeAddress(data);
    });
  }, [id, onChangeWholeAddress]);

  const handleSearchTermChange = 
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event) return;
      if (!event.target) return;

      props.onChange(event);
    };

  return (
      <input
        id={id}
        className="form-control"
        onChange={handleSearchTermChange}
        value={props.value}
        placeholder="Street Address"
      />
  );
}

export default AddressField;
