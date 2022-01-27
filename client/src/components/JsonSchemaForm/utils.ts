import getFromPath from 'lodash/get';

export const getSchemaValue = (props: object, name: string): string | undefined => 
  getFromPath(props, ['schema', name])
      || getFromPath(props, ['uiSchema', 'ui:options', name])
      || getFromPath(props, ['uiSchema', `ui:${name}`])
      || getFromPath(props, name);

interface ArrayProps {
  items?: object,
}

export const getSchemaItemsValue = (props: ArrayProps, name: string): string | undefined =>
  getSchemaValue((props.items || {}), name)
      || getFromPath(props, name);

