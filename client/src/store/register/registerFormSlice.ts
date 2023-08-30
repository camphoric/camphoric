import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { FormData, PricingResults }from 'components/JsonSchemaForm';
import { RootState, useAppSelector } from './store';
import type { InitialPaymentBody } from './api';

export interface RegisterFormState {
  registration: FormData;
  totals: PricingResults;
  paymentStep?: ApiRegisterPaymentStep;
  paymentInfo?: InitialPaymentBody;
  confirmationStep?: ApiRegisterConfirmationStep;
  updating: boolean;
}

// Define the initial state using that type
export const initialState: RegisterFormState = {
  registration: { campers: [{}] },
  totals: { total: 0, campers: [] },
  updating: false,
}

export const registerFormSlice = createSlice({
  name: 'registerForm',
  // `createSlice` will infer the state type from the `initialState` argument
  initialState,
  reducers: {
    setUpdating: (state, action: PayloadAction<boolean>) => {
      state.updating = action.payload;
    },
    setRegFormData: (state, action: PayloadAction<FormData>) => {
      state.registration = action.payload;
    },
    setTotals: (state, action: PayloadAction<PricingResults>) => {
      state.totals = action.payload;
    },
    setPaymentInfo: (state, action: PayloadAction<InitialPaymentBody>) => {
      state.paymentInfo = action.payload;
    },
    setPaymentStep: (state, action: PayloadAction<ApiRegisterPaymentStep>) => {
      state.paymentStep = action.payload;
    },
    setConfirmationStep: (state, action: PayloadAction<ApiRegisterConfirmationStep>) => {
      state.confirmationStep = action.payload;
    },
    resetAll: (state) => initialState,
  },
})

export const {
  setUpdating,
  setRegFormData,
  setTotals,
  setPaymentStep,
  setPaymentInfo,
  setConfirmationStep,
  resetAll,
} = registerFormSlice.actions;

// Other code such as selectors can use the imported `RootState` type
export const useRegFormData = () => useAppSelector(
  (state: RootState) => state.registerForm
);

export default registerFormSlice.reducer
