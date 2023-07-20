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

const likeEnumDisabled = /enumDisabled/;
export const adminUISchemea = (schema: { [key: string]: any }) => {
  const value = { ...schema };

  Object.keys(value).forEach((k) => {
    if (likeEnumDisabled.test(k)) {
      return delete value[k];
    }

    if (!Array.isArray(value[k]) && typeof value[k] === 'object') {
      value[k] = adminUISchemea(value[k]);
    }
  });

  return value;
}
