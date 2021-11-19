import React from 'react';
import { template2Html } from './util';

interface Props {
  markdown?: string;
  templateVars?: {};
}

function Template(props: Props) {
  let markdown = props.markdown;
  let templateVars = props.templateVars;

  if (!markdown || typeof markdown !== 'string') {
    markdown = '';
  }

  return (
    <div
      className="md-template"
      dangerouslySetInnerHTML={template2Html(markdown, templateVars)}
    />
  );
}

export default Template;
