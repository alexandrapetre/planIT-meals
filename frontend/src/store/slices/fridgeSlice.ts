import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AxiosError } from 'axios';
import api from '../../api/axios';
import type { FridgeItem, RecipeSuggestion } from '../../types';

interface FridgeState {
  items: FridgeItem[];
  suggestions: RecipeSuggestion[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  suggestionsStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: FridgeState = {
  items: [],
  suggestions: [],
  status: 'idle',
  suggestionsStatus: 'idle',
  error: null,
};

export type FridgeItemPayload = Omit<
  FridgeItem,
  '_id' | 'user' | 'createdAt' | 'updatedAt'
>;

const extractError = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as AxiosError<{ message?: string }>;
    return axiosErr.response?.data?.message || fallback;
  }
  return fallback;
};

export const fetchFridge = createAsyncThunk<FridgeItem[], void, { rejectValue: string }>(
  'fridge/fetch',
  async (_, thunkAPI) => {
    try {
      const { data } = await api.get<FridgeItem[]>('/fridge');
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(extractError(err, 'fridge.loadError'));
    }
  }
);

export const addFridgeItem = createAsyncThunk<
  FridgeItem,
  FridgeItemPayload,
  { rejectValue: string }
>('fridge/add', async (payload, thunkAPI) => {
  try {
    const { data } = await api.post<FridgeItem>('/fridge', payload);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(extractError(err, 'fridge.addError'));
  }
});

export const updateFridgeItem = createAsyncThunk<
  FridgeItem,
  { id: string; payload: Partial<FridgeItemPayload> },
  { rejectValue: string }
>('fridge/update', async ({ id, payload }, thunkAPI) => {
  try {
    const { data } = await api.put<FridgeItem>(`/fridge/${id}`, payload);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(extractError(err, 'fridge.updateError'));
  }
});

export const deleteFridgeItem = createAsyncThunk<string, string, { rejectValue: string }>(
  'fridge/delete',
  async (id, thunkAPI) => {
    try {
      await api.delete(`/fridge/${id}`);
      return id;
    } catch (err) {
      return thunkAPI.rejectWithValue(extractError(err, 'fridge.deleteError'));
    }
  }
);

export const fetchSuggestions = createAsyncThunk<
  RecipeSuggestion[],
  void,
  { rejectValue: string }
>('fridge/suggestions', async (_, thunkAPI) => {
  try {
    const { data } = await api.get<RecipeSuggestion[]>('/fridge/suggestions');
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(extractError(err, 'fridge.suggestionsError'));
  }
});

const fridgeSlice = createSlice({
  name: 'fridge',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFridge.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchFridge.fulfilled, (state, action: PayloadAction<FridgeItem[]>) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchFridge.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'common.error';
      })
      .addCase(addFridgeItem.fulfilled, (state, action: PayloadAction<FridgeItem>) => {
        const idx = state.items.findIndex((i) => i._id === action.payload._id);
        if (idx >= 0) state.items[idx] = action.payload;
        else state.items.push(action.payload);
      })
      .addCase(updateFridgeItem.fulfilled, (state, action: PayloadAction<FridgeItem>) => {
        const idx = state.items.findIndex((i) => i._id === action.payload._id);
        if (idx >= 0) state.items[idx] = action.payload;
      })
      .addCase(deleteFridgeItem.fulfilled, (state, action: PayloadAction<string>) => {
        state.items = state.items.filter((i) => i._id !== action.payload);
      })
      .addCase(fetchSuggestions.pending, (state) => {
        state.suggestionsStatus = 'loading';
      })
      .addCase(
        fetchSuggestions.fulfilled,
        (state, action: PayloadAction<RecipeSuggestion[]>) => {
          state.suggestionsStatus = 'succeeded';
          state.suggestions = action.payload;
        }
      )
      .addCase(fetchSuggestions.rejected, (state, action) => {
        state.suggestionsStatus = 'failed';
        state.error = action.payload || 'common.error';
      });
  },
});

export default fridgeSlice.reducer;
