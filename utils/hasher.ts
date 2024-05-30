import bcrypt from "bcryptjs";
import { TConfig } from "./config";

export interface IHasher {
  hashPassword: (password: string) => Promise<string>;
  checkPassword: (password: string, hash: string) => Promise<boolean>;
}

export class Hasher {
  private config: TConfig;
  constructor(config: TConfig) {
    this.config = config;
  }

  async hashPassword(password: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, this.config.hashCost);
      return hash;
    } catch (error) {
      throw error;
    }
  }

  async checkPassword(password: string, hash: string): Promise<boolean> {
    try {
      const validPassword = await bcrypt.compare(password, hash);
      return validPassword;
    } catch (error) {
      throw error;
    }
  }
}
