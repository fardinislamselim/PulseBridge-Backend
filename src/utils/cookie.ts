import type { Response, CookieOptions } from 'express';
import { env } from '../config/env.js';

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;

const isProduction = env.NODE_ENV === 'production';

export const getBaseCookieOptions = (): CookieOptions => {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    domain: env.COOKIE_DOMAIN ? env.COOKIE_DOMAIN : undefined,
    path: '/',
  };
};

export const getAccessTokenCookieOptions = (): CookieOptions => {
  return {
    ...getBaseCookieOptions(),
    maxAge: 15 * 60 * 1000, // 15 minutes
  };
};

export const getRefreshTokenCookieOptions = (): CookieOptions => {
  return {
    ...getBaseCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
};

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, getAccessTokenCookieOptions());
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, getRefreshTokenCookieOptions());
};

export const clearAuthCookies = (res: Response): void => {
  const clearOptions = getBaseCookieOptions();
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearOptions);
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearOptions);
};
