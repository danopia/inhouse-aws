import { Random } from "@cloudydeno/ddp/random";
import { MongoClient } from "mongodb";

export const mongoClient = await new MongoClient(
  Deno.env.get('MONGO_URL')
    ?? 'mongodb://127.0.0.1:3001/meteor?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.8.1').connect();
// export const mongoClient = new MongoClient("mongodb://127.0.0.1:27017");

export const mongoDb = mongoClient.db();

export const random = new Random();

export class ServiceError extends Error {
  constructor(
    public readonly error: string | number,
    public readonly reason?: string,
    public readonly details?: string,
  ) {
    super(`${reason} [${error}]`);
  }
};

export type ReqAuthCtx = {
  accountId: string;
  accessKeyId: string;
  sessionToken?: string;
};

export type ReqCtx = {
  req: Request;
  connInfo: Deno.ServeHandlerInfo<Deno.NetAddr>;
  region: string;
  requestId: string;
  destAccountId?: string;
  auth: ReqAuthCtx;
}
