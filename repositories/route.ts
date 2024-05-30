import { TRouteRequest } from "../dtos/auth";
import { TRoute, TRouteModel } from "../models/route";

export interface IRouteRepository {
  findOneByName: (name: string) => Promise<TRoute | null>;
  updateOne: (route: TRouteRequest) => Promise<void>;
  deleteOne: (name: string) => Promise<void>;
}

export class RouteRepository {
  private routeModel: TRouteModel;
  constructor(routeModel: TRouteModel) {
    this.routeModel = routeModel;
  }

  async findOneByName(name: string): Promise<TRoute | null> {
    try {
      const route = await this.routeModel.findOne({ name });
      return route;
    } catch (error) {
      throw error;
    }
  }

  async updateOne(route: TRouteRequest): Promise<void> {
    try {
      await this.routeModel.findOneAndUpdate(
        { name: route.name },
        {
          restrictions: route.restrictions,
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
        { upsert: true, runValidators: false, new: true, lean: true }
      );
    } catch (error) {
      throw error;
    }
  }

  async deleteOne(name: string): Promise<void> {
    try {
      await this.routeModel.updateOne({ name }, { deleted_at: new Date().toISOString() });
    } catch (error) {
      throw error;
    }
  }
}
