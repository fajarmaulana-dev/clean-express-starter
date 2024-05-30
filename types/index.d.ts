import { Request } from "express";

export interface Request<B = any, Q = any, P = any, C = any> extends Request {
  body: B;
  query: Q;
  params: P;
  cookies: C;
}
