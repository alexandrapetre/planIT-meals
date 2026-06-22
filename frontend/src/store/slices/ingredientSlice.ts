import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AxiosError } from 'axios';
import api from '../../api/axios';
import type { Ingredient } from '../../types';

interface IngredientState {
  items: Ingredient[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: IngredientState = {
  items: [],
  status: 'idle',
  error: null,
};

const extractError = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as AxiosError<{ message?: string }>;
    return axiosErr.response?.data?.message || fallback;
  }
  return fallback;
};

export const fetchIngredients = createAsyncThunk<Ingredient[], void, { rejectValue: string }>(
  'ingredients/fetch',
  async (_, thunkAPI) => {
    try {
      const { data } = await api.get<Ingredient[]>('/ingredients');
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(extractError(err, 'ingredients.loadError'));
    }
  }
);

export type IngredientPayload = Omit<Ingredient, '_id'>;

export const createIngredient = createAsyncThunk<
  Ingredient,
  IngredientPayload,
  { rejectValue: string }
>('ingredients/create', async (payload, thunkAPI) => {
  try {
    const { data } = await api.post<Ingredient>('/ingredients', payload);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(extractError(err, 'ingredients.createError'));
  }
});

const ingredientSlice = createSlice({
  name: 'ingredients',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchIngredients.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchIngredients.fulfilled, (state, action: PayloadAction<Ingredient[]>) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchIngredients.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'common.error';
      })
      .addCase(createIngredient.fulfilled, (state, action: PayloadAction<Ingredient>) => {
        state.items.push(action.payload);
      });
  },
});

export default ingredientSlice.reducer;
