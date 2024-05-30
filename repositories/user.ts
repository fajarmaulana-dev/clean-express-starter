import { TResetPasswordRequest } from "../dtos/auth";
import { TResetPassword, TResetPasswordModel } from "../models/resetpassword-token";
import { TUser, TUserModel, TUserRole } from "../models/user";

export interface IUserRepository {
  findOneByEmail: (email: string) => Promise<TUser | null>;
  findOneByToken: (token: string) => Promise<TUser | null>;
  createOne: (user: TUser) => Promise<void>;
  updateMailToken: (email: string, token?: string) => Promise<void>;
  updatePassword: (email: string, roles: TUserRole[]) => Promise<void>;
  updatePicture: (email: string, picture: string) => Promise<void>;
  findOneResetToken: (
    token: Omit<TResetPasswordRequest, "password">
  ) => Promise<TResetPassword | null>;
  createOneResetToken: (token: Omit<TResetPasswordRequest, "password">) => Promise<void>;
  deleteResetToken: (email: string, role: string) => Promise<void>;
  deleteOne: (email: string) => Promise<void>;
}

export class UserRepository {
  private userModel: TUserModel;
  private resetModel: TResetPasswordModel;
  constructor(userModel: TUserModel, resetModel: TResetPasswordModel) {
    this.userModel = userModel;
    this.resetModel = resetModel;
  }

  async findOneByEmail(email: string): Promise<TUser | null> {
    try {
      return await this.userModel.findOne({ email });
    } catch (error) {
      throw error;
    }
  }

  async findOneByToken(token: string): Promise<TUser | null> {
    try {
      return await this.userModel.findOne({ verify_email_token: token });
    } catch (error) {
      throw error;
    }
  }

  async createOne(user: TUser): Promise<void> {
    try {
      await this.userModel.findOneAndUpdate(
        { email: user.email },
        {
          email: user.email,
          verify_email_token: user.verify_email_token,
          roles: user.roles,
          updated_at: new Date().toISOString(),
          deleted_at: null,
          expired_at: user.verify_email_token
            ? new Date(new Date().setDate(new Date().getDate() + 3))
            : null,
        },
        { upsert: true, runValidators: false, new: true, lean: true }
      );
    } catch (error) {
      throw error;
    }
  }

  async updateMailToken(email: string, token?: string): Promise<void> {
    try {
      await this.userModel.updateOne(
        { email },
        {
          verify_email_token: token ?? null,
          expired_at: token ? new Date(new Date().setDate(new Date().getDate() + 3)) : null,
          updated_at: new Date().toISOString(),
        }
      );
    } catch (error) {
      throw error;
    }
  }

  async updatePassword(email: string, roles: TUserRole[]): Promise<void> {
    try {
      await this.userModel.updateOne(
        { email },
        {
          roles,
          updated_at: new Date().toISOString(),
        }
      );
    } catch (error) {
      throw error;
    }
  }

  async updatePicture(email: string, picture: string): Promise<void> {
    try {
      await this.userModel.updateOne(
        { email },
        {
          picture,
          updated_at: new Date().toISOString(),
        }
      );
    } catch (error) {
      throw error;
    }
  }

  async findOneResetToken(
    token: Omit<TResetPasswordRequest, "password">
  ): Promise<TResetPassword | null> {
    try {
      if (!token.token)
        return await this.resetModel
          .findOne({ email: token.email, role: token.role })
          .sort({ expired_at: -1 })
          .exec();
      return await this.resetModel.findOne({ ...token });
    } catch (error) {
      throw error;
    }
  }

  async createOneResetToken(token: Omit<TResetPasswordRequest, "password">): Promise<void> {
    try {
      const newResetToken = new this.resetModel({ ...token });
      await newResetToken.save();
    } catch (error) {
      throw error;
    }
  }

  async deleteResetToken(email: string, role: string): Promise<void> {
    try {
      await this.resetModel.deleteMany({ email, role });
    } catch (error) {
      throw error;
    }
  }

  async deleteOne(email: string): Promise<void> {
    try {
      await this.userModel.updateOne({ email }, { deleted_at: new Date().toISOString() });
    } catch (error) {
      throw error;
    }
  }
}
