import React from 'react';
import { useHistory } from 'react-router-dom';
import api from 'store/register/api';
import debounce from 'lodash/debounce';
import debug from 'utils/debug';
import { calculatePrice }from 'components/JsonSchemaForm';

import {
  setRegFormData,
  setTotals,
  resetAll,
  useAppDispatch,
  setUpdating,
} from 'store/register/store';

const allSlashes = /\//g;
export const useNavigateToRegPage = () => {
  const history = useHistory();

  return (to: string) => {
    const pathParts = history.location.pathname.split('/').slice(0, -1);
    pathParts.push(to.replace(allSlashes, ''))

    history.push({
      ...history.location,
      pathname: pathParts.join('/'),
    });
  }
}

const getLocalStorageKey = (config: ApiRegister) => {
  const name = config.dataSchema.title || 'formData';
  const date = config.event.start;

  return `${name}, ${date.year}-${date.month}-${date.day}`;
}

export const useLocalStorageFormData = () => {
  const registrationApi = api.useGetRegistrationQuery();
  const [rehydrated, setRehydrated] = React.useState(false);
  const dispatch = useAppDispatch();

  const config = registrationApi.data;
  let key: string;

  if (config) {
    key = getLocalStorageKey(config);
  }

  return {
    // Save to both local storage, redux, and recalc price
    saveFormData: debounce(async (formData) => {
      if (!key) return;
      if (!config) throw new Error('registrationApi.data is not defined');

      debug('saving form data');
      await dispatch(() => setUpdating(true));
      try {
        dispatch(setRegFormData(formData));
        dispatch(
          setTotals(calculatePrice(config, formData))
        );

        localStorage.setItem(key, JSON.stringify(formData));
      } catch (e) {
        console.error(e);
      } finally {
        dispatch(setUpdating(false));
      }
    }, 600, {leading:false, trailing:true}),

    // status of rehydration
    rehydrated,

    // restore from local storage, save to redux, and recalc price
    rehydrateFormData: () => {
      if (!key || rehydrated) return;
      if (!config) throw new Error('registrationApi.data is not defined');

      let formData;
      try {
        const saved = localStorage.getItem(key);

        if (!saved) {
          debug('no local storage form data');
          setRehydrated(true);

          return;
        }

        formData = JSON.parse(saved);

        dispatch(setRegFormData(formData));
        dispatch(
          setTotals(calculatePrice(config, formData))
        );

        setRehydrated(true);
      } catch (e) {
        console.error(e);
      }

      return formData;
    },

    // at the end of process, reset all data
    resetFormData: () => {
      if (!key) return;

      try {
        localStorage.removeItem(key);
        dispatch(resetAll());
        setRehydrated(false);
      } catch (e) {
        console.error(e);
      }
    },
  };
}

