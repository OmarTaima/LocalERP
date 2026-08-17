import Joi from "joi";

const journalLineSchema = Joi.object({
  accountId: Joi.string().min(1).required(),
  debit: Joi.number().min(0).required(),
  credit: Joi.number().min(0).required(),
  currency: Joi.string().length(3).default("USD"),
  fxRate: Joi.number().positive().default(1),
  description: Joi.string().max(200).default(""),
});

export const journalEntrySchema = Joi.object({
  date: Joi.string().isoDate().required(),
  description: Joi.string().min(1).max(500).required(),
  reference: Joi.object({
    type: Joi.string().min(1).required(),
    id: Joi.string().min(1).required(),
  }).required(),
  lines: Joi.array().items(journalLineSchema).min(2).required(),
}).custom((value: { lines: Array<{ debit: number; credit: number }> }, helpers) => {
  const hasUnbalancedLine = value.lines.some((line) => (line.debit > 0) === (line.credit > 0));
  if (hasUnbalancedLine) {
    return helpers.error("journal.invalidLines");
  }
  const debit = value.lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = value.lines.reduce((sum, line) => sum + line.credit, 0);
  if (Math.abs(debit - credit) > 0.001) {
    return helpers.error("journal.unbalanced");
  }
  return value;
}, "journal entry integrity").messages({
  "journal.invalidLines": "each line must have exactly one of debit or credit",
  "journal.unbalanced": "journal entry must balance: total debits must equal total credits",
});

export const accountSchema = Joi.object({
  code: Joi.string().pattern(/^\d{2,6}$/).required(),
  name: Joi.string().min(1).max(120).required(),
  type: Joi.string().valid("asset", "liability", "equity", "revenue", "expense", "contra").required(),
  parentId: Joi.string().allow(null).optional(),
  currency: Joi.string().length(3).allow(null).optional(),
});

export const accountUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(120).optional(),
  parentId: Joi.string().allow(null).optional(),
  currency: Joi.string().length(3).allow(null).optional(),
});

export const expenseSchema = Joi.object({
  description: Joi.string().min(1).max(300).required(),
  amount: Joi.number().positive().required(),
  category: Joi.string().min(1).max(80).required(),
  date: Joi.string().isoDate().required(),
  receiptUrl: Joi.string().uri().allow(null).optional(),
});

export const expenseUpdateSchema = expenseSchema.fork(["description", "amount", "category", "date", "receiptUrl"], (schema) => schema.optional());

export const exchangeRateSchema = Joi.object({
  fromCurrency: Joi.string().length(3).uppercase().required(),
  toCurrency: Joi.string().length(3).uppercase().required(),
  rate: Joi.number().positive().required(),
  date: Joi.string().isoDate().optional(),
});

export const expenseClaimSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        description: Joi.string().min(1).required(),
        amount: Joi.number().positive().required(),
        date: Joi.string().isoDate().required(),
        receiptUrl: Joi.string().uri().optional(),
      }),
    )
    .min(1)
    .required(),
});

export const expenseClaimStatusSchema = Joi.object({
  status: Joi.string().valid("submitted", "approved", "rejected", "paid").required(),
});