import { resMessage } from "../constants/response-data";
import appError from "../errors/apperror";
import {
  TChangePasswordRequest,
  TGoogleAuthRequest,
  TLoginRequest,
  TLoginResponse,
  TRegisterRequest,
  TResetPasswordRequest,
  convertUserToLoginResponse,
  TRoleRequest,
  TRouteRequest,
} from "../dtos/auth";
import { IRoleRepository } from "../repositories/role";
import { IUserRepository } from "../repositories/user";
import { IMailer } from "../utils/mailer";
import { IHasher } from "../utils/hasher";
import { nanoid } from "nanoid";
import { IJwtProvider, TJwt } from "../utils/jwt-provider";
import { IGoogleSigner } from "../utils/google-signer";
import { TRole } from "../models/role";
import { cDefaultAdditions, cRole, cRoute, cTokenLen } from "../constants/auth";
import { IRouteRepository } from "../repositories/route";
import { TRoute } from "../models/route";
import { TUser, TUserRole } from "../models/user";
import { TConfig } from "../utils/config";

export interface IAuthService {
  register: (payloads: TRegisterRequest) => Promise<string | null>;
  verifyEmail: (token: string) => Promise<void>;
  resendMailToken: (email: string) => Promise<string>;
  login: (payloads: TLoginRequest) => Promise<{ user: TLoginResponse; token: TJwt }>;
  refreshToken: (refreshToken: string) => Promise<TJwt>;
  verifyPassword: (payloads: TChangePasswordRequest) => Promise<void>;
  changePassword: (payloads: TChangePasswordRequest) => Promise<void>;
  mailForgotPassword: (email: string, role: string) => Promise<string>;
  resetPassword: (payloads: TResetPasswordRequest) => Promise<void>;
  googleOauth: (payloads: TGoogleAuthRequest) => Promise<{ user: TLoginResponse; token: TJwt }>;
  addRole: (payloads: TRoleRequest) => Promise<TRoleRequest>;
  updateRole: (payloads: TRoleRequest) => Promise<TRoleRequest>;
  addRoute: (payloads: TRouteRequest) => Promise<TRouteRequest>;
  updateRoute: (payloads: TRouteRequest) => Promise<TRouteRequest>;
}

export class AuthService {
  private userRepository: IUserRepository;
  private roleRepository: IRoleRepository;
  private routeRepository: IRouteRepository;
  private hasher: IHasher;
  private jwtProvider: IJwtProvider;
  private mailer: IMailer;
  private googleSigner: IGoogleSigner;
  private config: TConfig;
  constructor(
    userRepository: IUserRepository,
    roleRepository: IRoleRepository,
    routeRepository: IRouteRepository,
    hasher: IHasher,
    jwtProvider: IJwtProvider,
    mailer: IMailer,
    googleSigner: IGoogleSigner,
    config: TConfig
  ) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.routeRepository = routeRepository;
    this.hasher = hasher;
    this.jwtProvider = jwtProvider;
    this.mailer = mailer;
    this.googleSigner = googleSigner;
    this.config = config;
  }

  async register(payloads: TRegisterRequest): Promise<string | null> {
    try {
      const role = await this.roleRepository.findOneByName(payloads.role);
      if (!role) throw appError.notFound(resMessage.roleIsNotFound);

      const user = await this.userRepository.findOneByEmail(payloads.email);
      if (user && user.roles.find((r) => r.name == payloads.role))
        throw appError.conflict(resMessage.userIsRegistered);

      if (role.registration.approvement) {
        if (!role.registration.whitelist.includes(payloads.email))
          throw appError.unauthorized(resMessage.restrictedRole);
        role.registration.whitelist = role.registration.whitelist.filter(
          (w) => w !== payloads.email
        );
        await this.roleRepository.updateRegistration(role);
      }

      const hashedPassword = await this.hasher.hashPassword(payloads.additions.password);
      payloads.additions.password = hashedPassword;
      const additions = new Map();
      additions.set("picture", null);
      const addsKeys = role.additions.map((a) => a.name);
      Object.keys(payloads.additions).forEach((a) => {
        if ([...addsKeys, ...cDefaultAdditions].includes(a))
          additions.set(a, payloads.additions[a]);
      });

      const verify_email_token = user ? null : nanoid(cTokenLen);
      await this.userRepository.createOne({
        email: payloads.email,
        verify_email_token: verify_email_token,
        roles: [...(user ? user.roles : []), { name: payloads.role, additions }],
        addresses: user ? user.addresses : [],
      });

      if (verify_email_token) {
        await this.mailer.sendMail({
          email: payloads.email,
          subject: "MyApp Account Verification",
          path: `/auth/verify?token=${verify_email_token}&role=${payloads.role}`,
          user: payloads.additions.name,
          text: "The access to verify your account will be expired in 3 days. Please click on the button bellow to verify your account.",
          btn: "Verify Account",
        });
      }

      return verify_email_token;
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  async verifyEmail(token: string): Promise<void> {
    try {
      const user = await this.userRepository.findOneByToken(token);
      if (!user) throw appError.unauthorized(resMessage.invalidToken);

      await this.userRepository.updateMailToken(user.email);
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  async resendMailToken(email: string): Promise<string> {
    try {
      const user = await this.userRepository.findOneByEmail(email);
      if (!user) throw appError.notFound(resMessage.userIsNotFound);
      if (!user.verify_email_token) throw appError.conflict(resMessage.userIsVerified);
      if (new Date().getTime() < user.updated_at!.getTime() + this.config.verifyMailPause)
        throw appError.tooManyReq(this.config.verifyMailPause);

      const verify_email_token = nanoid(cTokenLen);
      await this.userRepository.updateMailToken(user.email, verify_email_token);
      await this.mailer.sendMail({
        email: email,
        subject: "MyApp Account Verification",
        path: `/auth/verify?token=${verify_email_token}`,
        user: user.roles[0].additions.get("name"),
        text: "Please click on the button bellow to verify your account.",
        btn: "Verify Account",
      });

      return new Date(new Date().getTime() + this.config.verifyMailPause).toISOString();
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  async login(payloads: TLoginRequest): Promise<{ user: TLoginResponse; token: TJwt }> {
    try {
      const role = await this.roleRepository.findOneByName(payloads.role);
      if (!role) throw appError.notFound(resMessage.roleIsNotFound);

      const user = await this.userRepository.findOneByEmail(payloads.email);
      if (!user) throw appError.notFound(resMessage.userIsNotFound);
      if (user.verify_email_token) throw appError.unauthorized(resMessage.userUnverified);
      if (!user.roles.find((r) => r.name == payloads.role))
        throw appError.unauthorized(resMessage.invalidRole);

      const currentRole = user.roles.find((r) => r.name == payloads.role) as TUserRole;
      const validPassword = await this.hasher.checkPassword(
        payloads.password,
        currentRole.additions.get("password")
      );
      if (!validPassword) throw appError.unauthorized(resMessage.wrongPassword);

      const token = await this.jwtProvider.sign({ email: payloads.email, role: payloads.role });
      return { user: convertUserToLoginResponse(user, currentRole, role.limits), token };
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  async refreshToken(refreshToken: string): Promise<TJwt> {
    try {
      if (!refreshToken) throw appError.forbidden(resMessage.noRefreshToken);
      const user = await this.jwtProvider.verify(refreshToken);
      if (!user) throw appError.forbidden(resMessage.invalidToken);

      const token = await this.jwtProvider.sign(user, refreshToken);
      return token;
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  async verifyPassword(payloads: TChangePasswordRequest): Promise<void> {
    try {
      const user = await this.userRepository.findOneByEmail(payloads.email);
      const currentRole = (user as TUser).roles.find((r) => r.name == payloads.role);
      if (!currentRole) throw appError.notFound(resMessage.invalidRole);
      const validPassword = await this.hasher.checkPassword(
        payloads.password,
        currentRole.additions.get("password")
      );
      if (!validPassword) throw appError.unauthorized(resMessage.wrongPassword);
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  private async setPassword(payloads: TChangePasswordRequest): Promise<TUserRole[]> {
    const user = await this.userRepository.findOneByEmail(payloads.email);
    const currentRole = (user as TUser).roles.find((r) => r.name == payloads.role);
    if (!currentRole) throw appError.notFound(resMessage.invalidRole);

    const hashedPassword = await this.hasher.hashPassword(payloads.password);
    return (user as TUser).roles.map((r) => {
      if (r.name == payloads.role) {
        r.additions.set("password", hashedPassword);
        return r;
      }
      return r;
    });
  }

  async changePassword(payloads: TChangePasswordRequest): Promise<void> {
    try {
      const newRoles = await this.setPassword(payloads);
      await this.userRepository.updatePassword(payloads.email, newRoles);
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  async mailForgotPassword(email: string, role: string): Promise<string> {
    try {
      const lastToken = await this.userRepository.findOneResetToken({ email, role, token: null });
      if (
        lastToken &&
        new Date().getTime() < lastToken.created_at!.getTime() + this.config.forgotPassPause
      )
        throw appError.tooManyReq(lastToken.created_at!.getTime() + this.config.forgotPassPause);

      const existRole = await this.roleRepository.findOneByName(role);
      if (!existRole) throw appError.notFound(resMessage.roleIsNotFound);

      const user = await this.userRepository.findOneByEmail(email);
      if (!user) throw appError.notFound(resMessage.userIsNotFound);
      if (user.verify_email_token) throw appError.unauthorized(resMessage.userUnverified);

      const currentRole = (user as TUser).roles.find((r) => r.name == role);
      if (!currentRole) throw appError.notFound(resMessage.invalidRole);
      const token = nanoid(cTokenLen);
      await this.mailer.sendMail({
        email: email,
        subject: "Reset Password Access",
        path: `/auth/reset-password?email=${email}&token=${token}&role=${role}`,
        user: currentRole.additions.get("name"),
        text: "This access will be expired in 10 minutes. Please click on the button bellow to reset your password.",
        btn: "Reset Password",
      });

      await this.userRepository.createOneResetToken({ email, token, role });
      return new Date(new Date().getTime() + this.config.forgotPassPause).toISOString();
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  async resetPassword(payloads: TResetPasswordRequest): Promise<void> {
    try {
      const { password, ...token } = payloads;
      const tokenData = await this.userRepository.findOneResetToken(token);
      if (!tokenData) throw appError.unauthorized(resMessage.invalidToken);

      const newRoles = await this.setPassword(payloads);
      await this.userRepository.updatePassword(token.email, newRoles);
      await this.userRepository.deleteResetToken(token.email, token.role);
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  async googleOauth(payloads: TGoogleAuthRequest): Promise<{ user: TLoginResponse; token: TJwt }> {
    try {
      const googleToken = await this.googleSigner.getToken(payloads.auth_code);
      const userData = await this.googleSigner.getUserData(googleToken);
      if (!userData.verified_email) throw appError.unauthorized(resMessage.userUnverified);
      const picture = userData.picture == "" ? null : userData.picture;

      const role = await this.roleRepository.findOneByName(payloads.role);
      if (!role) throw appError.notFound(resMessage.roleIsNotFound);

      let user = await this.userRepository.findOneByEmail(userData.email);
      const additions = new Map();
      role.additions.forEach((a) => additions.set(a.name, null));
      if (!user) {
        additions.set("name", userData.name);
        additions.set("picture", picture);
        additions.set("password", null);
      }

      user = {
        email: userData.email,
        verify_email_token: null,
        roles: [...(user ? user.roles : []), { name: payloads.role, additions }],
        addresses: user ? user.addresses : [],
      };
      await this.userRepository.createOne(user);

      const token = await this.jwtProvider.sign({ email: user.email, role: payloads.role });
      const currentRole = user.roles.find((r) => r.name == payloads.role) as TUserRole;
      return { user: convertUserToLoginResponse(user, currentRole, role.limits), token };
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  private async cleanRole(payloads: TRoleRequest): Promise<TRoleRequest> {
    try {
      const limits: TRole["limits"] = [];
      const limitSet = new Set<string>();
      for (const a of payloads.limits) {
        if (limitSet.has(a.page)) continue;
        if (!cRole.access.includes(a.access)) throw appError.badRequest(resMessage.otherRolePermit);
        limits.push(a);
        limitSet.add(a.page);
      }

      payloads.registration.whitelist = [...new Set(payloads.registration.whitelist)];
      return { ...payloads, limits };
    } catch (error) {
      throw error;
    }
  }

  async addRole(payloads: TRoleRequest): Promise<TRoleRequest> {
    try {
      const existRole = await this.roleRepository.findOneByName(payloads.name);
      if (existRole) throw appError.conflict(resMessage.roleIsExist);

      const cleanRole = await this.cleanRole(payloads);
      await this.roleRepository.updateOne(cleanRole);
      return cleanRole;
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  async updateRole(payloads: TRoleRequest): Promise<TRoleRequest> {
    try {
      const existRole = await this.roleRepository.findOneByName(payloads.name);
      if (!existRole) throw appError.notFound(resMessage.roleIsNotFound);

      const cleanRole = await this.cleanRole(payloads);
      await this.roleRepository.updateOne(cleanRole);
      return cleanRole;
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  private async cleanRoute(payloads: TRouteRequest): Promise<TRouteRequest> {
    try {
      const restrictions: TRoute["restrictions"] = [];
      const restrictSet = new Set();
      for (const r of payloads.restrictions) {
        if (restrictSet.has(r.method)) continue;
        if (!cRoute.method.includes(r.method))
          throw appError.badRequest(resMessage.otherRouteMethod);
        restrictions.push({ method: r.method, roles: [...new Set(r.roles)] });
        restrictSet.add(r.method);
      }
      return { name: payloads.name, restrictions };
    } catch (error) {
      throw error;
    }
  }

  async addRoute(payloads: TRouteRequest): Promise<TRouteRequest> {
    try {
      const existRoute = await this.routeRepository.findOneByName(payloads.name);
      if (existRoute) throw appError.conflict(resMessage.serverRouteIsExist);

      const cleanRoute = await this.cleanRoute(payloads);
      await this.routeRepository.updateOne(cleanRoute);
      return cleanRoute;
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }

  async updateRoute(payloads: TRouteRequest): Promise<TRouteRequest> {
    try {
      const existRoute = await this.routeRepository.findOneByName(payloads.name);
      if (!existRoute) throw appError.notFound(resMessage.serverRouteIsNotFound);

      const cleanRoute = await this.cleanRoute(payloads);
      await this.routeRepository.updateOne(cleanRoute);
      return cleanRoute;
    } catch (error) {
      if (error instanceof appError.AppError) throw error;
      throw appError.internalServer(error as Error);
    }
  }
}
