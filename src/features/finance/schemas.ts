import { z } from "zod";

// Field rules shared by contribution entry, target plans and report filters.
export const amount = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Use up to 12 whole digits and two decimal places.");
export const positiveAmount = amount.refine(value => Number(value) > 0, "Enter an amount greater than zero.");
export const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Use a three-letter currency code.");
export const optionalId = z.union([z.uuid(), z.literal("")]);
