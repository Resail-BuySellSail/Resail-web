import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { denormalisedResponseEntities } from '../../util/data';
import { storableError } from '../../util/errors';
import { saveShippingAddress as saveShippingAddressApi } from '../../util/api';
import { setCurrentUser } from '../../ducks/user.duck';

// ================ Async thunks ================ //

/**
 * Validate the shipping address with Shippo and save it to the current user's privateData.
 * On success, currentUser is updated in the store.
 *
 * @param {Object} params
 * @param {string} params.addressType 'shipFrom' or 'shipTo'
 * @param {Object} params.address { name, phone, street1, streetNo, city, state, zip, country }
 */
export const saveShippingAddressThunk = createAsyncThunk(
  'ShippingAddressesPage/saveShippingAddress',
  ({ addressType, address }, { dispatch, rejectWithValue }) => {
    return saveShippingAddressApi({ addressType, address })
      .then(response => {
        const entities = denormalisedResponseEntities(response);
        if (entities.length !== 1) {
          throw new Error('Expected a resource in the save shipping address response');
        }
        dispatch(setCurrentUser(entities[0]));
        return { addressType };
      })
      .catch(e => {
        // Keep the error code and validation messages from the server (e.g. 'invalid-address')
        return rejectWithValue({ ...storableError(e), code: e.code, messages: e.messages });
      });
  }
);
// Backward compatible wrapper for the saveShippingAddress thunk
// Note: we unwrap the thunk so that the promise chain can be listened on presentational components.
export const saveShippingAddress = params => dispatch => {
  return dispatch(saveShippingAddressThunk(params)).unwrap();
};

// ================ Slice ================ //

const shippingAddressesPageSlice = createSlice({
  name: 'ShippingAddressesPage',
  initialState: {
    saveAddressInProgress: null,
    saveAddressError: null,
    savedAddressType: null,
  },
  reducers: {
    clearSaveAddressState: state => {
      state.saveAddressError = null;
      state.savedAddressType = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(saveShippingAddressThunk.pending, (state, action) => {
        state.saveAddressInProgress = action.meta.arg.addressType;
        state.saveAddressError = null;
        state.savedAddressType = null;
      })
      .addCase(saveShippingAddressThunk.fulfilled, (state, action) => {
        state.saveAddressInProgress = null;
        state.savedAddressType = action.payload.addressType;
      })
      .addCase(saveShippingAddressThunk.rejected, (state, action) => {
        state.saveAddressInProgress = null;
        state.saveAddressError = {
          addressType: action.meta.arg.addressType,
          error: action.payload,
        };
      });
  },
});

export const { clearSaveAddressState } = shippingAddressesPageSlice.actions;

export default shippingAddressesPageSlice.reducer;
