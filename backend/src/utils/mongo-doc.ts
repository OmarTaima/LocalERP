import type { Types } from "mongoose";

export type MongoDoc<T> = Omit<T, "id"> & { _id: Types.ObjectId };