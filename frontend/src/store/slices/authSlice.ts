import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AxiosError } from 'axios';
import api from '../../api/axios';
import type { AuthResponse, User, UserPreferences } from '../../types';

interface AuthState {
  user: User | null;
  token: string | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const userFromStorage = localStorage.getItem('user');
const tokenFromStorage = localStorage.getItem('token');

const initialState: AuthState = {
  user: userFromStorage ? (JSON.parse(userFromStorage) as User) : null,
  token: tokenFromStorage || null,
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

export const login = createAsyncThunk<AuthResponse, LoginPayload, { rejectValue: string }>(
  'auth/login',
  async (credentials, thunkAPI) => {
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', credentials);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(extractError(err, 'auth.login.error'));
    }
  }
);

export const register = createAsyncThunk<AuthResponse, RegisterPayload, { rejectValue: string }>(
  'auth/register',
  async (payload, thunkAPI) => {
    try {
      const { data } = await api.post<AuthResponse>('/auth/register', payload);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(extractError(err, 'auth.register.error'));
    }
  }
);

export const fetchMe = createAsyncThunk<User, void, { rejectValue: string }>(
  'auth/me',
  async (_, thunkAPI) => {
    try {
      const { data } = await api.get<User>('/auth/me');
      localStorage.setItem('user', JSON.stringify(data));
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(extractError(err, 'auth.sessionExpired'));
    }
  }
);

interface UpdateProfilePayload {
  name?: string;
  email?: string;
  preferences?: UserPreferences;
  password?: string;
}

export const updateProfile = createAsyncThunk<User, UpdateProfilePayload, { rejectValue: string }>(
  'auth/updateProfile',
  async (payload, thunkAPI) => {
    try {
      const { data } = await api.put<User>('/auth/me', payload);
      localStorage.setItem('user', JSON.stringify(data));
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(extractError(err, 'profile.updateError'));
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      state.status = 'idle';
      state.error = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<AuthResponse>) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'auth.login.error';
      })
      .addCase(register.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action: PayloadAction<AuthResponse>) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'auth.register.error';
      })
      .addCase(fetchMe.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user = null;
        state.token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .addCase(updateProfile.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.error = action.payload || 'profile.updateError';
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
