const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

async function createCheckout(email) {
  return stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    customer_email: email,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: "BB AI Pro" },
        unit_amount: 999,
        recurring: { interval: "month" }
      },
      quantity: 1
    }],
    success_url: "https://bb-ai-core.onrender.com/success",
    cancel_url: "https://bb-ai-core.onrender.com/cancel"
  });
}

// webhook handler (IMPORTANT FIXED)
async function handleStripeEvent(event) {
  if (event.type === "checkout.session.completed") {
    const email = event.data.object.customer_email;

    await User.findOneAndUpdate(
      { email },
      { pro: true }
    );

    console.log("🔥 PRO UNLOCKED:", email);
  }
}

module.exports = { createCheckout, handleStripeEvent };
