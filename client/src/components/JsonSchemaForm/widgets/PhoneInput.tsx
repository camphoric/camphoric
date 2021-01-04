import ReactPhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css'

interface Props {
  onChange: (value: string) => void;
  value: string;
}

export default function PhoneInput (props: Props) {
  return (
    <ReactPhoneInput
      country="us"
      value={props.value}
      onChange={props.onChange}
    />
  );
}
