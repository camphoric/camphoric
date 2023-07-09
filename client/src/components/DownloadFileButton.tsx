import React from 'react';
import { Button } from 'react-bootstrap';

type Props = {
  data: string;
  type: string;
  name: string;
  children: string | JSX.Element | JSX.Element[] | (() => JSX.Element),
};


function DownloadFileButton({ data, type, name, ...props }: Props) {
  const downloadFile = () => {
    const element = document.createElement('a');
    const file = new Blob([data], { type });
    element.href = URL.createObjectURL(file);
    element.download = name;
    document.body.appendChild(element);
    element.click();
  }

  return (
    <Button onClick={downloadFile}>
      {props.children}
    </Button>
  );
}

export default DownloadFileButton;
