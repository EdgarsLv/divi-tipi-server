import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { stripe } from "./service/index.js";
import {
  createOrRetrieveCustomer,
  manageSubstriptionStatusChange,
} from "./utils/index.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.
    verify: function (req, res, buf) {
      if (req.originalUrl.startsWith("/webhook")) {
        req.rawBody = buf.toString();
      }
    },
  })
);

const domainURL = process.env.DOMAIN_URL;

app.post("/create-checkout-session", async (req, res) => {
  const { priceId, email, uuid } = req.body;

  try {
    const customer = await createOrRetrieveCustomer({ uuid, email });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer,
      locale: "lv",
      payment_method_types: ["card"],
      success_url: `${domainURL}/page2?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domainURL}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(400);
    console.log(e.message);
    return res.send({
      error: {
        message: e.message,
      },
    });
  }
});

app.post("/customer-portal", async (req, res) => {
  const { uuid } = req.body;

  try {
    const customer = await createOrRetrieveCustomer({ uuid });

    // const configuration = await stripe.billingPortal.configurations.update(
    //   "bpc_1MiPz0BMJFV3kDeez9KrnTdp",
    //   {
    //     features: {
    //       customer_update: {
    //         enabled: true,
    //         allowed_updates: ["email", "address", "phone"],
    //       },
    //       invoice_history: { enabled: true },
    //       subscription_cancel: {
    //         cancellation_reason: {
    //           enabled: true,
    //           options: ["too_expensive", "customer_service", "other"],
    //         },
    //         enabled: true,
    //         mode: "at_period_end",
    //         proration_behavior: "none",
    //       },
    //     },
    //     business_profile: {
    //       headline: "Divi Tipi bla bla bla",
    //     },
    //   }
    // );

    const portalSession = await stripe.billingPortal.sessions.create({
      customer,
      locale: "lv",
      return_url: `${domainURL}/page2`,
      configuration: "bpc_1MiPz0BMJFV3kDeez9KrnTdp",
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (e) {
    res.status(400);
    console.log(e.message);
    return res.send({
      error: {
        message: e.message,
      },
    });
  }
});

app.post("/delete-customer", async (req, res) => {
  const { customerId } = req.body;

  try {
    await stripe.customers.del(customerId);

    return res.status(200).json({});
  } catch (e) {
    res.status(400);
    console.log(e.message);
    return res.send({
      error: {
        message: e.message,
      },
    });
  }
});

app.post("/cancel-subscription", async (req, res) => {
  const { subscriptionId } = req.body;

  try {
    await stripe.subscriptions.del(subscriptionId);

    return res.status(200).json({});
  } catch (e) {
    res.status(400);
    console.log(e.message);
    return res.send({
      error: {
        message: e.message,
      },
    });
  }
});

// sub_1MiilxBMJFV3kDeeb4keC3GM

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  let data;
  let eventType;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (webhookSecret) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers["stripe-signature"];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.log(`⚠️ Webhook signature verification failed.`, err.message);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  switch (eventType) {
    case "checkout.session.completed":
      //   console.log("session", data);
      // Payment is successful and the subscription is created.
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      const subscription = data.object;
      manageSubstriptionStatusChange(subscription.id, subscription.customer);
      break;

    case "customer.created":
      console.log("customer created", data);
      break;
    default:
    // Unhandled event type
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT || 4242, () =>
  console.log(`Listen port ${process.env.PORT}`)
);
