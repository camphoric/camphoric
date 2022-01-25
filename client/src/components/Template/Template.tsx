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

  let html;

  try {
    html = template2Html(markdown, templateVars);
  } catch (e) {
    html = {
      __html: `
<pre>
error with template render

${e}

</pre>`,
    }
  }

  return (
    <div
      className="md-template"
      dangerouslySetInnerHTML={html}
    />
  );
}

export default Template;
