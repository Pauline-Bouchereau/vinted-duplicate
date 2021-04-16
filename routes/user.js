// Import necessary packages and middlewares
const express = require("express");
const router = express.Router();
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const cloudinary = require("cloudinary").v2;
const encBase64 = require("crypto-js/enc-base64");

// Import the models
const User = require("../models/User");
const Offer = require("../models/Offer");

// Route to create an account (sign up)
router.post("/user/signup", async (req, res) => {
  try {
    const { email, username, phone, password } = req.fields;
    if (email) {
      // Check if the email doesn't already exist in DB
      const emailToCheck = await User.findOne({ email: email });
      if (!emailToCheck) {
        if (username && password) {
          // Generate a salt
          const salt = uid2(16);
          // Generate an hash
          const hash = SHA256(salt + password).toString(encBase64);
          // Generate a token
          const token = uid2(64);

          // Create a new user in DB
          const newUser = new User({
            email: email,
            account: {
              username: username,
              phone: phone,
            },
            token: token,
            hash: hash,
            salt: salt,
          });

          // Add an avatar (upload pic to Cloudify)
          if (req.files.avatar) {
            const avatarPic = req.files.avatar.path;
            let result = await cloudinary.uploader.upload(avatarPic, {
              folder: "/vinted/users/" + newUser._id,
            });

            newUser.account.avatar = result;
          }

          // Save new User
          await newUser.save();

          // Respond to client
          res.status(201).json({
            _id: newUser._id,
            token: newUser.token,
            account: {
              username: newUser.account.username,
              phone: newUser.account.phone,
            },
          });
        } else {
          res.status(400).json({
            message: "Please provide a username and a password.",
          });
        }
      } else {
        res
          .status(409)
          .json({ message: "There already is an account with this email." });
      }
    } else {
      res.status(400).json({ message: "Please provide an email." });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to log in the account
router.post("/user/login", async (req, res) => {
  try {
    // Check if there is an account with this email
    const userWithEmail = await User.findOne({ email: req.fields.email });
    if (userWithEmail) {
      // Create a new hash with the pwd provided in the body
      const newHash = SHA256(userWithEmail.salt + req.fields.password).toString(
        encBase64
      );

      // Check if the newHash is the same as the one in the DB and respond to the client
      if (newHash === userWithEmail.hash) {
        res.status(200).json({
          _id: userWithEmail.id,
          token: userWithEmail.token,
          account: {
            username: userWithEmail.account.username,
            phone: userWithEmail.account.phone,
          },
        });
      } else {
        res.status(401).json({ message: "Unauthorized" });
      }
    } else {
      res.status(400).json({ message: "Unauthorized" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Export the routes
module.exports = router;
