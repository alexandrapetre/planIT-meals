import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AxiosError } from 'axios';
import api from '../../api/axios';
import type { MealPlan, ShoppingList } from '../../types';

interface MealPlanState {
  items: MealPlan[];
  current: MealPlan | null;
  shoppingLists: Record<string, ShoppingList>;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  shoppingStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: MealPlanState = {
  items: [],
  current: null,
  shoppingLists: {},
  status: 'idle',
  shoppingStatus: 'idle',
  error: null,
};

const extractError = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as AxiosError<{ message?: string }>;
    return axiosErr.response?.data?.message || fallback;
  }
  return fallback;
};

export const fetchMealPlans = createAsyncThunk<MealPlan[], void, { rejectValue: string }>(
  'mealPlans/fetch',
  async (_, thunkAPI) => {
    try {
      const { data } = await api.get<MealPlan[]>('/meal-plans');
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(extractError(err, 'mealPlan.loadError'));
    }
  }
);

interface GeneratePayload {
  startDate?: string;
  days?: number;
}

interface SwapMealPayload {
  planId: string;
  dayIndex: number;
  mealType: string;
}

export const generateMealPlan = createAsyncThunk<
  MealPlan,
  GeneratePayload,
  { rejectValue: string }
>('mealPlans/generate', async (payload, thunkAPI) => {
  try {
    const { data } = await api.post<MealPlan>('/meal-plans/generate', payload);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(extractError(err, 'mealPlan.generateError'));
  }
});

export const deleteMealPlan = createAsyncThunk<string, string, { rejectValue: string }>(
  'mealPlans/delete',
  async (id, thunkAPI) => {
    try {
      await api.delete(`/meal-plans/${id}`);
      return id;
    } catch (err) {
      return thunkAPI.rejectWithValue(extractError(err, 'mealPlan.deleteError'));
    }
  }
);

export const swapMealInPlan = createAsyncThunk<
  MealPlan,
  SwapMealPayload,
  { rejectValue: string }
>('mealPlans/swapMeal', async ({ planId, dayIndex, mealType }, thunkAPI) => {
  try {
    const { data } = await api.post<MealPlan>(`/meal-plans/${planId}/swap`, {
      dayIndex,
      mealType,
    });
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(extractError(err, 'mealPlan.swapError'));
  }
});

export const fetchShoppingList = createAsyncThunk<
  ShoppingList,
  string,
  { rejectValue: string }
>('mealPlans/shoppingList', async (planId, thunkAPI) => {
  try {
    const { data } = await api.get<ShoppingList>(`/meal-plans/${planId}/shopping-list`);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(extractError(err, 'mealPlan.shoppingListError'));
  }
});

const mealPlanSlice = createSlice({
  name: 'mealPlans',
  initialState,
  reducers: {
    setCurrent(state, action: PayloadAction<MealPlan | null>) {
      state.current = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMealPlans.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchMealPlans.fulfilled, (state, action: PayloadAction<MealPlan[]>) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchMealPlans.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'common.error';
      })
      .addCase(generateMealPlan.fulfilled, (state, action: PayloadAction<MealPlan>) => {
        state.items.unshift(action.payload);
        state.current = action.payload;
      })
      .addCase(swapMealInPlan.fulfilled, (state, action: PayloadAction<MealPlan>) => {
        state.items = state.items.map((plan) =>
          plan._id === action.payload._id ? action.payload : plan
        );
        if (state.current?._id === action.payload._id) {
          state.current = action.payload;
        }
        delete state.shoppingLists[action.payload._id];
      })
      .addCase(swapMealInPlan.rejected, (state, action) => {
        state.error = action.payload || 'common.error';
      })
      .addCase(deleteMealPlan.fulfilled, (state, action: PayloadAction<string>) => {
        state.items = state.items.filter((p) => p._id !== action.payload);
        if (state.current?._id === action.payload) state.current = null;
        delete state.shoppingLists[action.payload];
      })
      .addCase(fetchShoppingList.pending, (state) => {
        state.shoppingStatus = 'loading';
      })
      .addCase(fetchShoppingList.fulfilled, (state, action: PayloadAction<ShoppingList>) => {
        state.shoppingStatus = 'succeeded';
        state.shoppingLists[action.payload.planId] = action.payload;
      })
      .addCase(fetchShoppingList.rejected, (state, action) => {
        state.shoppingStatus = 'failed';
        state.error = action.payload || 'common.error';
      });
  },
});

export const { setCurrent } = mealPlanSlice.actions;
export default mealPlanSlice.reducer;
