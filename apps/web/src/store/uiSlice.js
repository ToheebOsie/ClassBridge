import { createSlice } from '@reduxjs/toolkit';

/**
 * Interface settings shared across the app. Server data (invoices, students...)
 * will live in RTK Query, not here. See docs/architecture.md.
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState: { accent: '#2740a0' },
  reducers: {
    /** Set the school's colour, e.g. from the school's settings. */
    setAccent(state, action) {
      state.accent = action.payload;
    },
  },
});

export const { setAccent } = uiSlice.actions;
export default uiSlice.reducer;
