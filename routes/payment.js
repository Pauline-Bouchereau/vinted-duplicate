const express = require("express");
const isAuthenticated = require("../middlewares/isAuthenticated");
const stripe = require("stripe")(
  "sk_test_51IpuDxFzl7D5XfKorJ8a03tnrsb1Hs26WS0o0OAcpjOeB4JnrlXU9e3S4GZry3nfK8WNy8NtgUnTEQHkeBQxh4ly00MWCKJ0B8"
);
const router = express.Router();

// Import the models
const User = require("../models/User");
const Offer = require("../models/Offer");

// Route to handle payment
router.post("/payment", isAuthenticated, async (req, res) => {
  try {
    //Get Stripe Token from the body
    const stripeToken = req.fields.stripeToken;

    // Get id of the user buying the article
    const idUserBuying = req.user._id;

    // Get info about product bought
    const product = await Offer.findById(req.fields.productId);

    // Create the transaction
    const response = await stripe.charges.create({
      //ammount: (product.product_price * 100).toFixed(0),
      ammount: 2000,
      currency: "eur",
      source: stripeToken,
      description: product.product_name,
      name: `User Id : ${idUserBuying}`,
    });
    console.log(response);
    if (response.status === "succeeded") {
      res.status(200).json(response);
    } else {
      res.status(400).json({ message: "An error has occurred." });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
