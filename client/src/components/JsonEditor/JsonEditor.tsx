/**
 * JsonEditor
 *
 * based on the react demo in jsoneditor
 * https://github.com/josdejong/jsoneditor/tree/develop/examples/react_demo
 */

import React from 'react';
import {
  JSONEditor,
  type Content,
  type Mode,
} from 'vanilla-jsoneditor';
import { faFloppyDisk } from '@fortawesome/free-regular-svg-icons'

interface Props {
  content: Content;
  onChange?: (a: object) => void;
  onSave?: (a: Content) => void;
}

const Editor = ({ onSave, ...props }: Props) => {
  const refContainer = React.useRef<HTMLDivElement>(null);
  const refEditor = React.useRef<JSONEditor>(null);

  React.useEffect(() => {
    // create editor
    if (!refContainer.current) return;

    // @ts-ignore
    refEditor.current = new JSONEditor({
      target: refContainer.current,
      props: {}
    });

    return () => {
      // destroy editor
      if (refEditor.current) {
        refEditor.current.destroy();
        // @ts-ignore
        refEditor.current = null;
      }
    };
  }, []);

  // update props
  React.useEffect(() => {
    if (refEditor.current) {
      refEditor.current.updateProps({
        mode: 'text' as Mode,
        ...props,
        onRenderMenu: (items, context) => {
          let buttons = items;

          if (onSave) {
            buttons = [
              ...items.slice(0, items.length - 1),
              {
                type: "separator",
              },
              {
                type: "button",
                onClick: () => {
                  if (!refEditor.current) return;

                  const json = refEditor.current.get();

                  onSave(json as Content);
                },
                icon: faFloppyDisk,
                title: "save",
                className: "custom-copy-button",
              },
              {
                type: "space",
              },
            ];
          }

          return buttons;
        },
      });
    }
  }, [props, onSave]);

  return (
    <div
      className="vanilla-jsoneditor-react jse-theme-dark"
      ref={refContainer}
    />
  );
}

export {
  type Content,
} from 'vanilla-jsoneditor';
export default Editor;
