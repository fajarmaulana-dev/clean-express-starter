import { TUser, TUserRole } from "../models/user";
import { TRole } from "../models/role";
import { TRoute } from "../models/route";

export type TRegisterRequest = Pick<TUser, "email"> & {
  additions: Record<string, any>;
  role: string;
};

export type TLoginRequest = Pick<TUser, "email"> & { password: string; role: string };
export type TLoginResponse = Pick<TUser, "email" | "addresses"> & {
  additions: Record<string, any>;
  role: string;
  limits: TRole["limits"];
};

export type TChangePasswordRequest = {
  email: string;
  password: string;
  role: string;
};
export type TResetPasswordRequest = TChangePasswordRequest & {
  token: string | null;
};

export type TGoogleAuthRequest = {
  auth_code: string;
  role: string;
};
export type TGoogleAuthToken = {
  id_token: string;
  access_token: string;
};
export type TGoogleAuthUserResponse = {
  name: string;
  email: string;
  picture: string;
  verified_email: boolean;
  gender?: string;
};

export const convertUserToLoginResponse = (
  user: TUser,
  role: TUserRole,
  limits: TRole["limits"]
): TLoginResponse => {
  role.additions.delete("password");
  return {
    email: user.email,
    role: role.name,
    addresses: user.addresses,
    additions: Object.fromEntries(role.additions),
    limits,
  };
};

export type TRoleRequest = Omit<TRole, "created_at" | "updated_at" | "deleted_at">;
export type TRouteRequest = Pick<TRoute, "name" | "restrictions">;
