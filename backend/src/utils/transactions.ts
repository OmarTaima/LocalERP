import mongoose from "mongoose";

let txSupported: boolean | null = null;

async function probeTransactions(): Promise<boolean> {
  const session = await mongoose.startSession();
  const collection = mongoose.connection.db!.collection("__tx_probe");
  try {
    await session.withTransaction(async () => {
      await collection.insertOne({ ok: 1 }, { session });
    });
    return true;
  } catch {
    return false;
  } finally {
    await session.endSession();
    await collection.deleteMany({}).catch(() => undefined);
  }
}

export async function runInTransaction<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    if (txSupported === null) {
      txSupported = await probeTransactions();
    }
    if (txSupported) {
      return await session.withTransaction(fn);
    }
    return await fn(session);
  } finally {
    await session.endSession();
  }
}