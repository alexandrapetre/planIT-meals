import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import authReducer from './slices/authSlice';
import recipeReducer from './slices/recipeSlice';
import mealPlanReducer from './slices/mealPlanSlice';
import mealLogReducer from './slices/mealLogSlice';
import ingredientReducer from './slices/ingredientSlice';
import fridgeReducer from './slices/fridgeSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    recipes: recipeReducer,
    mealPlans: mealPlanReducer,
    mealLogs: mealLogReducer,
    ingredients: ingredientReducer,
    fridge: fridgeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
