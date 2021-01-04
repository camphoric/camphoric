import React from 'react';
import ReactMarkdown from 'react-markdown'

interface Props {
  markdown?: string;
}

const renderers = {
  inlineCode: (obj: { value?: string }) => {
    return (
      <span className={obj.value || ''}></span>
    );
  },
}

function Markdown({ markdown }: Props) {
  return (
    <ReactMarkdown
      renderers={renderers}
      children={markdown || ''}
    />
  );
}

export default Markdown;
