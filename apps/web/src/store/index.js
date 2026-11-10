import { configureStore } from '@reduxjs/toolkit';
import { api } from './api.js';
import ui from './uiSlice.js';

export const makeStore = () =>
  configureStore({
    reducer: { ui, [api.reducerPath]: api.reducer },
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });
export const store = makeStore();
