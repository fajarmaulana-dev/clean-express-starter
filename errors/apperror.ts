import { resCode, resMessage } from "../constants/response-data";

class AppError extends Error {
  code: number;
  error: string;
  constructor(code: number, message: string, error: string) {
    super(message);
    this.code = code;
    this.error = error;
  }
}

const internalServer = (error: Error, message = resMessage.internalServer) =>
  new AppError(resCode.InternalServerError, message, error.message);
const notFound = (message: string) => new AppError(resCode.NotFound, message, message);
const conflict = (message: string) => new AppError(resCode.Conflict, message, message);
const unauthorized = (message: string) => new AppError(resCode.Unauthorized, message, message);
const badRequest = (message: string) => new AppError(resCode.BadRequest, message, message);
const forbidden = (message: string) => new AppError(resCode.Forbidden, message, message);
const tooManyReq = (time: number) => {
  const message = `access requests can only be made once every ${time / 60000} minutes`;
  return new AppError(resCode.TooManyRequests, message, message);
};

export default {
  AppError,
  internalServer,
  notFound,
  conflict,
  unauthorized,
  badRequest,
  forbidden,
  tooManyReq,
};
