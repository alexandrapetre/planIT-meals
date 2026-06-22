import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AxiosError } from 'axios';
import api from '../../api/axios';
import type { Recipe, RecipeFacets, RecipesPage } from '../../types';

interface RecipeState {
  items: Recipe[];
  total: number;
  /** Unfiltered recipe count for dashboard stats (not affected by category/search filters). */
  catalogTotal: number;
  limit: number;
  skip: number;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  facets: RecipeFacets;
  facetsStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const initialState: RecipeState = {
  items: [],
  total: 0,
  catalogTotal: 0,
  limit: 60,
  skip: 0,
  status: 'idle',
  error: null,
  facets: { categories: [], areas: [] },
  facetsStatus: 'idle',
};

function hasRecipeFilters(params?: FetchRecipesParams) {
  if (!params) return false;
  return Boolean(
    params.search || params.category || params.area || params.tag || params.source
  );
}

export interface FetchRecipesParams {
  search?: string;
  tag?: string;
  category?: string;
  area?: string;
  source?: 'user' | 'seed';
  limit?: number;
  skip?: number;
}

export type RecipePayload = Omit<
  Recipe,
  '_id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'source' | 'externalId'
>;

const extractError = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as AxiosError<{ message?: string }>;
    return axiosErr.response?.data?.message || fallback;
  }
  return fallback;
};

export const fetchRecipes = createAsyncThunk<
  RecipesPage,
  FetchRecipesParams | undefined,
  { rejectValue: string }
>('recipes/fetch', async (params, thunkAPI) => {
  try {
    const { data } = await api.get<RecipesPage>('/recipes', { params });
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(extractError(err, 'recipes.loadError'));
  }
});

export const fetchRecipeCatalogTotal = createAsyncThunk<
  number,
  void,
  { rejectValue: string }
>('recipes/catalogTotal', async (_, thunkAPI) => {
  try {
    const { data } = await api.get<RecipesPage>('/recipes', { params: { limit: 1 } });
    return data.total;
  } catch (err) {
    return thunkAPI.rejectWithValue(extractError(err, 'recipes.loadError'));
  }
});

export const fetchRecipeFacets = createAsyncThunk<
  RecipeFacets,
  void,
  { rejectValue: string }
>('recipes/facets', async (_, thunkAPI) => {
  try {
    const { data } = await api.get<RecipeFacets>('/recipes/facets');
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(extractError(err, 'recipes.loadError'));
  }
});

export const createRecipe = createAsyncThunk<Recipe, RecipePayload, { rejectValue: string }>(
  'recipes/create',
  async (payload, thunkAPI) => {
    try {
      const { data } = await api.post<Recipe>('/recipes', payload);
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(extractError(err, 'recipes.createError'));
    }
  }
);

export const deleteRecipe = createAsyncThunk<string, string, { rejectValue: string }>(
  'recipes/delete',
  async (id, thunkAPI) => {
    try {
      await api.delete(`/recipes/${id}`);
      return id;
    } catch (err) {
      return thunkAPI.rejectWithValue(extractError(err, 'recipes.deleteError'));
    }
  }
);

const recipeSlice = createSlice({
  name: 'recipes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecipes.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchRecipes.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.items;
        state.total = action.payload.total;
        state.limit = action.payload.limit;
        state.skip = action.payload.skip;
        if (!hasRecipeFilters(action.meta.arg)) {
          state.catalogTotal = action.payload.total;
        }
      })
      .addCase(fetchRecipeCatalogTotal.fulfilled, (state, action: PayloadAction<number>) => {
        state.catalogTotal = action.payload;
      })
      .addCase(fetchRecipes.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'common.error';
      })
      .addCase(fetchRecipeFacets.pending, (state) => {
        state.facetsStatus = 'loading';
      })
      .addCase(fetchRecipeFacets.fulfilled, (state, action: PayloadAction<RecipeFacets>) => {
        state.facetsStatus = 'succeeded';
        state.facets = action.payload;
      })
      .addCase(fetchRecipeFacets.rejected, (state) => {
        state.facetsStatus = 'failed';
      })
      .addCase(createRecipe.fulfilled, (state, action: PayloadAction<Recipe>) => {
        state.items.unshift(action.payload);
        state.total += 1;
        state.catalogTotal += 1;
      })
      .addCase(deleteRecipe.fulfilled, (state, action: PayloadAction<string>) => {
        state.items = state.items.filter((r) => r._id !== action.payload);
        state.total = Math.max(0, state.total - 1);
        state.catalogTotal = Math.max(0, state.catalogTotal - 1);
      });
  },
});

export default recipeSlice.reducer;
