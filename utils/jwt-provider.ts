import jwt from "jsonwebtoken";
import { TConfig } from "./config";
import { JWK, JWE } from "node-jose";

export type TJwt = {
  accessToken: string;
  refreshToken: string;
};

export type TJwtPayloads = {
  email: string;
  role: string;
};

export interface IJwtProvider {
  sign: (payloads: TJwtPayloads, refresh?: string) => Promise<TJwt>;
  verify: (token: string, forAccess?: boolean) => Promise<TJwtPayloads | null>;
}

export class JwtProvider {
  private config: TConfig;
  constructor(config: TConfig) {
    this.config = config;
  }

  private async createKey() {
    try {
      const keystore = JWK.createKeyStore();
      const key = await keystore.add({
        kty: "oct",
        k: Buffer.from(this.config.secretKey).toString("base64"),
      });
      return key;
    } catch (error) {
      throw error;
    }
  }

  private async encryptJwt(payloads: TJwtPayloads): Promise<string> {
    try {
      const key = await this.createKey();
      const encrypted = await JWE.createEncrypt({ format: "compact" }, key)
        .update(JSON.stringify(payloads))
        .final();
      return encrypted;
    } catch (error) {
      throw error;
    }
  }

  private async decryptJwt(encryptedToken: string): Promise<TJwtPayloads> {
    try {
      const key = await this.createKey();
      const decrypted = await JWE.createDecrypt(key).decrypt(encryptedToken);
      return JSON.parse(decrypted.plaintext.toString());
    } catch (error) {
      throw error;
    }
  }

  async sign(payloads: TJwtPayloads, refresh?: string): Promise<TJwt> {
    try {
      const data = await this.encryptJwt(payloads);
      const accessToken = jwt.sign({ data }, this.config.accessKey, {
        expiresIn: this.config.accessExp / 1000,
        issuer: this.config.issuer,
      });

      let refreshToken = "";
      if (!refresh) {
        refreshToken = jwt.sign({ data }, this.config.refreshKey, {
          expiresIn: this.config.refreshExp / 1000,
          issuer: this.config.issuer,
        });
      }

      return { accessToken, refreshToken };
    } catch (error) {
      throw error;
    }
  }

  async verify(token: string, forAccess?: boolean): Promise<TJwtPayloads | null> {
    try {
      let key = this.config.refreshKey;
      if (forAccess) key = this.config.accessKey;

      const { data } = jwt.verify(token, key) as { data: string };
      if (!data) return null;
      const user = await this.decryptJwt(data);
      return user;
    } catch (error) {
      throw error;
    }
  }
}
