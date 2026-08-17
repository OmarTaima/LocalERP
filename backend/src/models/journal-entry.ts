import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
import type { JournalEntry } from "@erp/shared";

export type JournalEntryDoc = Omit<JournalEntry, "id" | "companyId" | "date" | "reversedById" | "createdBy"> & {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  date: Date;
  reversedById: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const { Schema } = mongoose;

const journalEntrySchema = new Schema<JournalEntryDoc>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    entryNumber: { type: String, required: true },
    date: { type: Date, required: true },
    description: { type: String, required: true },
    reference: {
      type: { type: String, required: true },
      id: { type: String, required: true },
    },
    lines: {
      type: [
        {
          accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
          debit: { type: Number, required: true, min: 0 },
          credit: { type: Number, required: true, min: 0 },
          currency: { type: String, default: "USD" },
          fxRate: { type: Number, default: 1 },
          description: { type: String, default: "" },
        },
      ],
      required: true,
    },
    status: { type: String, enum: ["posted", "reversed"], default: "posted" },
    reversedById: { type: Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

journalEntrySchema.index({ companyId: 1, entryNumber: 1 }, { unique: true });
journalEntrySchema.index({ companyId: 1, date: -1 });
journalEntrySchema.index({ companyId: 1, "reference.type": 1, "reference.id": 1 });

export const JournalEntryModel: Model<JournalEntryDoc> =
  (mongoose.models.JournalEntry as Model<JournalEntryDoc>) ||
  mongoose.model<JournalEntryDoc>("JournalEntry", journalEntrySchema);