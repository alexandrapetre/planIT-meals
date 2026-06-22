export interface UserPreferences {
  dietaryRestrictions?: string[];
  allergies?: string[];
  dailyCalorieGoal?: number;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  preferences?: UserPreferences;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Ingredient {
  _id: string;
  name: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  category: string;
}

export interface RecipeIngredient {
  ingredient?: string | Ingredient;
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  _id: string;
  title: string;
  description: string;
  instructions: string;
  ingredients: RecipeIngredient[];
  prepTime: number;
  cookTime: number;
  servings: number;
  calories: number;
  tags: string[];
  category?: string;
  area?: string;
  imageUrl?: string;
  youtubeUrl?: string;
  source?: 'user' | 'seed';
  externalId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecipesPage {
  items: Recipe[];
  total: number;
  limit: number;
  skip: number;
}

export interface RecipeFacets {
  categories: string[];
  areas: string[];
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Meal {
  type: MealType;
  recipe?: string | Recipe;
  notes?: string;
}

export interface MealPlanDay {
  date: string;
  meals: Meal[];
}

export interface MealPlan {
  _id: string;
  user: string;
  name: string;
  startDate: string;
  endDate: string;
  days: MealPlanDay[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiError {
  message: string;
}

export interface FridgeItem {
  _id: string;
  user: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecipeSuggestion {
  recipe: Recipe;
  matchPercent: number;
  ownedCount: number;
  missingCount: number;
  missing: { name: string; quantity: number; unit: string }[];
}

export interface ShoppingListItem {
  name: string;
  unit: string;
  needed: number;
  inFridge: number;
  missing: number;
}

export interface ShoppingList {
  planId: string;
  planName: string;
  items: ShoppingListItem[];
  alreadyCovered: ShoppingListItem[];
}

export interface MealLog {
  _id: string;
  user: string;
  date: string;
  mealType: MealType;
  recipe?: string | Recipe | null;
  name: string;
  imageUrl?: string;
  servingGrams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface MealLogDay {
  date: string;
  items: MealLog[];
  totals: MacroTotals;
}
