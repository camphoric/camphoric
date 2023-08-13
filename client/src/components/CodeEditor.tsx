import React from 'react';
import Editor from '@monaco-editor/react';
import { type editor } from 'monaco-editor';

export type EditorInstance = editor.IStandaloneCodeEditor;

export const defaultOptions = {
  minimap: {
    enabled: false
  }
};

export type EditorProps = React.ComponentProps<typeof Editor>;

class CodeEditor extends React.Component<EditorProps> {
  editorRef: EditorInstance | null = null;

  setRef = (editor: EditorInstance) => (this.editorRef = editor);
  setValue = (v: string) => this.editorRef?.setValue(v);
  getValue = () => this.editorRef?.getValue();

  render() {
    return (
      <Editor
        height="40vh"
        theme="vs-dark"
        onMount={this.setRef}
        options={defaultOptions}
        {...this.props}
      />
    );


  }
}

export default CodeEditor
