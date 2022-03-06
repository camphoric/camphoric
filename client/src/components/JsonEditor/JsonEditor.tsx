/**
 * JsonEditor
 *
 * based on the react demo in jsoneditor
 * https://github.com/josdejong/jsoneditor/tree/develop/examples/react_demo
 */

import React from 'react';
import JSONEditor, { JSONEditorOptions } from 'jsoneditor';
import 'jsoneditor/dist/jsoneditor.css'

interface Props {
  json: object;
  onChange?: (a: object) => void;
}

interface State {
  json: object;
};

class Editor extends React.PureComponent<Props, State> {
  private container = React.createRef<HTMLDivElement>();
  editor?: any;
  state: State = { json: {} }

  componentDidMount() {
    this.initializeEditor();
  }

  // Only do this once
  initializeEditor = () => {
    if (!this.container.current) {
      setTimeout(this.initializeEditor, 200);
      return;
    }

    const options: JSONEditorOptions  = {
      mode: 'tree',
      modes: ['tree'],
      onChangeJSON: (json: object) => this.onChange(json),
    };

    this.editor = new JSONEditor(this.container.current, options);
    this.editor.set(this.props.json);
  }

  onChange = (json: object) => {
    this.setState({ json });
    this.props.onChange && this.props.onChange(json);
  };

  getValue = () => this.state.json;

  componentWillUnmount() {
    if (this.editor) {
      this.editor.destroy();
    }
  }

  render() {
    return (
      <div className="jsoneditor-react-container" ref={this.container} />
      );
  }
}

export default Editor;
