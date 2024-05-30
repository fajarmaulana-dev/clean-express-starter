import { CookieOptions, NextFunction, Response } from "express";
import { IAuthService } from "../services/auth";
import {
  TGoogleAuthRequest,
  TLoginRequest,
  TRegisterRequest,
  TResetPasswordRequest,
  TRoleRequest,
  TRouteRequest,
} from "../dtos/auth";
import { Request } from "../types";
import { resCode, resMessage } from "../constants/response-data";
import { TConfig } from "../utils/config";
import { TJwtPayloads } from "../utils/jwt-provider";

export class AuthHandler {
  private authService: IAuthService;
  private accessCookie: CookieOptions;
  private refreshCookie: CookieOptions;

  constructor(authService: IAuthService, config: TConfig) {
    this.authService = authService;
    this.accessCookie = {
      expires: new Date(Date.now() + config.accessExp),
      maxAge: config.accessExp,
      httpOnly: true,
      sameSite: config.env === "release" ? "none" : "lax",
      secure: config.env === "release",
    };
    this.refreshCookie = { ...this.accessCookie };
    this.refreshCookie.expires = new Date(Date.now() + config.refreshExp);
    this.refreshCookie.maxAge = config.refreshExp;
  }

  register = async (req: Request<TRegisterRequest>, res: Response, next: NextFunction) => {
    try {
      const token = await this.authService.register(req.body);
      const message = token ? resMessage.successRegister : resMessage.successRegisterNewRole;
      res.status(resCode.Created).json({ message });
    } catch (error) {
      return next(error);
    }
  };

  verifyEmail = async (req: Request<{ token: string }>, res: Response, next: NextFunction) => {
    try {
      await this.authService.verifyEmail(req.body.token);
      res.status(resCode.OK).json({ message: resMessage.successVerifyEmail });
    } catch (error) {
      return next(error);
    }
  };

  resendMailToken = async (
    req: Request<{ email: string; role: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { email, role } = req.body;
      const max_date = await this.authService.resendMailToken(email);
      res.status(resCode.OK).json({
        message: resMessage.successRegister,
        data: { max_date, role },
      });
    } catch (error) {
      return next(error);
    }
  };

  login = async (req: Request<TLoginRequest>, res: Response, next: NextFunction) => {
    try {
      const { user, token } = await this.authService.login(req.body);
      res.cookie("access_token", token.accessToken, this.accessCookie);
      res.cookie("refresh_token", token.refreshToken, this.refreshCookie);
      res.status(resCode.OK).json({ message: resMessage.successLogin, data: user });
    } catch (error) {
      return next(error);
    }
  };

  refreshToken = async (
    req: Request<any, any, any, { refresh_token: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const token = await this.authService.refreshToken(req.cookies.refresh_token);
      res.cookie("access_token", token.accessToken, this.accessCookie);
      res.status(resCode.OK).json({ message: resMessage.successRefreshToken });
    } catch (error) {
      return next(error);
    }
  };

  verifyPassword = async (
    req: Request<{ password: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { password } = req.body;
      const { email, role }: TJwtPayloads = res.locals.user;
      await this.authService.verifyPassword({ password, email, role });
      res.status(resCode.OK).json({ message: resMessage.successVerifyPassword });
    } catch (error) {
      return next(error);
    }
  };

  changePassword = async (
    req: Request<{ password: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { password } = req.body;
      const { email, role }: TJwtPayloads = res.locals.user;
      await this.authService.changePassword({ password, email, role });
      res.status(resCode.OK).json({ message: resMessage.successChangePassword });
    } catch (error) {
      return next(error);
    }
  };

  mailForgotPassword = async (
    req: Request<{ email: string; role: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { email, role } = req.body;
      const max_date = await this.authService.mailForgotPassword(email, role);
      res.status(resCode.OK).json({
        message: resMessage.successSendResetPassAccess,
        data: { max_date, role },
      });
    } catch (error) {
      return next(error);
    }
  };

  resetPassword = async (
    req: Request<TResetPasswordRequest>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      await this.authService.resetPassword(req.body);
      res.status(resCode.OK).json({ message: resMessage.successResetPassword });
    } catch (error) {
      return next(error);
    }
  };

  googleOauth = async (req: Request<TGoogleAuthRequest>, res: Response, next: NextFunction) => {
    try {
      const { user, token } = await this.authService.googleOauth(req.body);
      res.cookie("access_token", token.accessToken, this.accessCookie);
      res.cookie("refresh_token", token.refreshToken, this.refreshCookie);
      res.status(resCode.OK).json({
        message: resMessage.successLogin,
        data: user,
      });
    } catch (error) {
      return next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    res.cookie("access_token", "", { maxAge: -1 });
    res.cookie("refresh_token", "", { maxAge: -1 });
    res.status(resCode.OK).json({ message: resMessage.successLogout });
  };

  addRole = async (req: Request<TRoleRequest>, res: Response, next: NextFunction) => {
    try {
      const role = await this.authService.addRole(req.body);
      res.status(resCode.Created).json({
        message: resMessage.successAddRole,
        data: role,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateRole = async (req: Request<TRoleRequest>, res: Response, next: NextFunction) => {
    try {
      const role = await this.authService.updateRole(req.body);
      res.status(resCode.OK).json({
        message: resMessage.successUpdateRole,
        data: role,
      });
    } catch (error) {
      return next(error);
    }
  };

  addRoute = async (req: Request<TRouteRequest>, res: Response, next: NextFunction) => {
    try {
      const route = await this.authService.addRoute(req.body);
      res.status(resCode.Created).json({
        message: resMessage.successAddRoute,
        data: route,
      });
    } catch (error) {
      return next(error);
    }
  };

  updateRoute = async (req: Request<TRouteRequest>, res: Response, next: NextFunction) => {
    try {
      const route = await this.authService.updateRoute(req.body);
      res.status(resCode.OK).json({
        message: resMessage.successUpdateRoute,
        data: route,
      });
    } catch (error) {
      return next(error);
    }
  };
}
