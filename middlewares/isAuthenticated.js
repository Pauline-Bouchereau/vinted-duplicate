const User = require("../models/User");

const isAuthenticated = async (req, res, next) => {
  try {
    // Check if a token is sent
    if (req.headers.authorization) {
      // Check if there is a user in the DB with this token
      const token = req.headers.authorization.replace("Bearer ", "");
      const userWithToken = await User.findOne({ token: token }).select(
        "account _id avatar"
      );

      if (userWithToken) {
        // Create a new key in req with the infos of the user
        req.user = userWithToken;
        // Next
        return next();
      } else {
        return res.status(401).json({ error: "Unauthorized" });
      }
    } else {
      return res.status(401).json({ error: "Unauthorized" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = isAuthenticated;
