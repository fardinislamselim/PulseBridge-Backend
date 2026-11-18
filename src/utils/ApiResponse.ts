import type { Response } from 'express';

export interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export class ApiResponse<T = unknown> {
  public readonly success: boolean = true;
  public readonly message: string;
  public readonly data: T;
  public readonly statusCode: number;

  constructor(statusCode: number, message: string, data?: T) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = (data !== undefined ? data : {}) as T;
  }

  public toJSON(): IApiResponse<T> {
    return {
      success: this.success,
      message: this.message,
      data: this.data,
    };
  }

  public send(res: Response): Response {
    return res.status(this.statusCode).json(this.toJSON());
  }

  public static success<T = unknown>(
    res: Response,
    message: string,
    data?: T,
    statusCode = 200
  ): Response {
    const response = new ApiResponse<T>(statusCode, message, data);
    return response.send(res);
  }

  public static created<T = unknown>(res: Response, message: string, data?: T): Response {
    return this.success(res, message, data, 201);
  }
}
