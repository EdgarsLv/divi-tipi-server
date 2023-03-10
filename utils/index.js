import { supabase, stripe } from "../service/index.js";

export const createOrRetrieveCustomer = async ({ email, uuid }) => {
  const { data, error } = await supabase
    .from("customers")
    .select("stripe_customer_id")
    .eq("id", uuid)
    .single();
  if (error || !data?.stripe_customer_id) {
    // No customer record found, let's create one.
    const customerData = {
      metadata: {
        supabaseUUID: uuid,
      },
    };
    if (email) customerData.email = email;

    const customer = await stripe.customers.create(customerData);

    // Now insert the customer ID into our Supabase mapping table.
    const { error: supabaseError } = await supabase
      .from("customers")
      .insert([{ id: uuid, stripe_customer_id: customer.id }]);

    if (supabaseError) throw supabaseError;

    return customer.id;
  }
  return data.stripe_customer_id;
};

export const manageSubstriptionStatusChange = async (
  subscriptionId,
  customerId
) => {
  try {
    console.log("manage");
    // const { data: customerData, error: noCustomerError } = await supabase
    //   .from("customers")
    //   .select("id")
    //   .eq("stripe_customer_id", customerId)
    //   .single();

    // if (noCustomerError) throw noCustomerError;

    // const { id: uuid } = customerData;

    // const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // const { error } = await supabase.from("subscriptions").upsert({
    //   id: subscription.id,
    //   user_id: uuid,
    //   price_id: subscription.items.data[0].price.id
    //   status: subscription.status,
    //   created: toDateTime(subscription.created).toISOString(),
    //   period_start: getTimeValue(subscription.current_period_start),
    //   period_end: getTimeValue(subscription.current_period_end),
    //   trial_start: getTimeValue(subscription.trial_start),
    //   trial_end: getTimeValue(subscription.trial_end),
    //   cancel_at: getTimeValue(subscription.cancel_at),
    //   canceled_at: getTimeValue(subscription.canceled_at),
    // });
    // if (error) {
    //   throw error;
    // }
  } catch (e) {
    console.log("upsert", e.message);
  }
};

const getTimeValue = (time) => {
  return time ? toDateTime(time).toISOString() : null;
};

const toDateTime = (secs) => {
  const t = new Date("1970-01-01T00:30:00Z"); // Unix epoch start.
  t.setSeconds(secs);
  return t;
};
