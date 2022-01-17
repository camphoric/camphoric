import getFromPath from 'lodash/get';

export const getSchemaValue = (props: object, name: string): string | undefined => 
  getFromPath(props, ['schema', name])
      || getFromPath(props, ['uiSchema', `ui:${name}`])
      || getFromPath(props, name);

export const getSchemaItemsValue = (props: object, name: string): string | undefined => 
  getFromPath(props, ['schema', 'items', name])
      || getFromPath(props, ['uiSchema', 'items', `ui:${name}`])
      || getFromPath(props, name);

