import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AxiosError } from 'axios';
import api from '../../api/axios';
import type { MacroTotals, MealLog, MealLogDay, MealType } from '../../types';
import { todayLocalDateKey } from '../../utils/localDate';

interface MealLogState {
  date: string;
  items: MealLog[];
  totals: MacroTotals;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  saving: boolean;
}

const emptyTotals: MacroTotals = { calories: 0, protein: 0, fat: 0, carbs: 0 };

const today = todayLocalDateKey;

const initialState: MealLogState = {
  date: today(),
  items: [],
  totals: { ...emptyTotals },
  status: 'idle',
  error: null,
  saving: false,
};

function computeTotals(items: MealLog[]): MacroTotals {
  return items.reduce<MacroTotals>(
    (acc, item) => ({
      calories: acc.calories + (item.calories || 0),
      protein: acc.protein + (item.protein || 0),
      fat: acc.fat + (item.fat || 0),
      carbs: acc.carbs + (item.carbs || 0),
    }),
    { ...emptyTotals }
  );
}

export interface MealLogPayload {
  date: string;
  mealType: MealType;
  recipe?: string;
  name?: string;
  imageUrl?: string;
  servingGrams?: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  notes?: string;
}

export const fetchMealLogs = createAsyncThunk<
  MealLogDay,
  { date: string },
  { rejectValue: string }
>('mealLogs/fetch', async ({ date }, thunkAPI) => {
  try {
    const res = await api.get<MealLogDay>('/meal-logs', { params: { date } });
    return res.data;
  } catch (err) {
    const axiosErr = err as AxiosError<{ message: string }>;
    return thunkAPI.rejectWithValue(
      axiosErr.response?.data?.message || 'Failed to load meal logs.'
    );
  }
});

export const createMealLog = createAsyncThunk<
  MealLog,
  MealLogPayload,
  { rejectValue: string }
>('mealLogs/create', async (payload, thunkAPI) => {
  try {
    const res = await api.post<MealLog>('/meal-logs', payload);
    return res.data;
  } catch (err) {
    const axiosErr = err as AxiosError<{ message: string }>;
    return thunkAPI.rejectWithValue(
      axiosErr.response?.data?.message || 'Failed to create meal log.'
    );
  }
});

export const deleteMealLog = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>('mealLogs/delete', async (id, thunkAPI) => {
  try {
    await api.delete(`/meal-logs/${id}`);
    return id;
  } catch (err) {
    const axiosErr = err as AxiosError<{ message: string }>;
    return thunkAPI.rejectWithValue(
      axiosErr.response?.data?.message || 'Failed to delete meal log.'
    );
  }
});

const mealLogSlice = createSlice({
  name: 'mealLogs',
  initialState,
  reducers: {
    setMealLogDate(state, action: PayloadAction<string>) {
      state.date = action.payload;
      state.items = [];
      state.totals = { ...emptyTotals };
      state.status = 'idle';
    },
    clearMealLogError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMealLogs.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchMealLogs.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.date = action.payload.date;
        state.items = action.payload.items;
        state.totals = action.payload.totals || computeTotals(action.payload.items);
      })
      .addCase(fetchMealLogs.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load meal logs.';
      })
      .addCase(createMealLog.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createMealLog.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload.date === state.date) {
          state.items.push(action.payload);
          state.totals = computeTotals(state.items);
        }
      })
      .addCase(createMealLog.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to create meal log.';
      })
      .addCase(deleteMealLog.fulfilled, (state, action) => {
        state.items = state.items.filter((i) => i._id !== action.payload);
        state.totals = computeTotals(state.items);
      })
      .addCase(deleteMealLog.rejected, (state, action) => {
        state.error = action.payload || 'Failed to delete meal log.';
      });
  },
});

export const { setMealLogDate, clearMealLogError } = mealLogSlice.actions;
export default mealLogSlice.reducer;
