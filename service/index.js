import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
