// Import necessary packages and middlewares
const express = require("express");
const formidable = require("express-formidable");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const isAuthenticated = require("../middlewares/isAuthenticated");
router.use(formidable());

// Import the models
const User = require("../models/User");
const Offer = require("../models/Offer");

// Route to publish a new offer
router.post("/offer/publish", isAuthenticated, async (req, res) => {
  try {
    if (
      req.fields.description.length <= 500 &&
      req.fields.title.length <= 50 &&
      req.fields.price <= 100000
    ) {
      // Create the new offer
      const newOffer = new Offer({
        product_name: req.fields.title,
        product_description: req.fields.description,
        product_price: req.fields.price,
        product_details: [
          { MARQUE: req.fields.brand },
          { TAILLE: req.fields.size },
          { ÉTAT: req.fields.condition },
          { COULEUR: req.fields.color },
          { EMPLACEMENT: req.fields.city },
        ],
        owner: req.user,
      });

      // Upload the picture to Cloudinary
      if (req.files.picture) {
        const pictureOffer = req.files.picture.path;
        let result = await cloudinary.uploader.upload(pictureOffer, {
          folder: "/vinted/offers/" + newOffer._id,
        });

        // Add result (infos about the uploaded image) to the document in DB
        newOffer.product_image = result;
      }

      await newOffer.save();

      // Respond to the client
      res.status(201).json(newOffer);
    } else {
      res.status(400).json({ message: "Please provide valid parameters" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to delete an offer
router.delete("/offer/delete", isAuthenticated, async (req, res) => {
  try {
    // Check if ID corresponds to an offer
    const offerToDelete = await Offer.findById(req.query.id);
    if (offerToDelete) {
      // Delete image from Cloudify
      await cloudinary.api.delete_resources(
        offerToDelete.product_image.public_id
      );
      // Delete offer from DB
      await Offer.findByIdAndDelete(req.query.id);

      // Respond to client
      res.status(200).json({ message: "Offer successfully deleted." });
    } else {
      res.status(400).json({ message: "This offer doesn't exist." });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to update an offer
router.put("/offer/update", isAuthenticated, async (req, res) => {
  try {
    // Check if ID corresponds to an offer
    const offerToUpdate = await Offer.findById(req.fields.id);
    if (offerToUpdate) {
      // Update the document
      offerToUpdate.product_name = req.fields.title;
      offerToUpdate.product_description = req.fields.description;
      offerToUpdate.product_price = req.fields.price;
      offerToUpdate.product_details[0].MARQUE = req.fields.brand;
      offerToUpdate.product_details[1].TAILLE = req.fields.size;
      offerToUpdate.product_details[2].ÉTAT = req.fields.condition;
      offerToUpdate.product_details[3].COULEUR = req.fields.color;
      offerToUpdate.product_details[4].EMPLACEMENT = req.fields.city;

      await offerToUpdate.save();
      // Respond to the client
      res.status(200).json(offerToUpdate);
    } else {
      res.status(400).json({ message: "This offer doesn't exist." });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to show all offers with filters and pagination
router.get("/offers", async (req, res) => {
  try {
    const { title, priceMin, priceMax, sort, limit, page } = req.query;
    // Check if filters sent in query, if yes, add it to the object filters
    const filters = {};
    if (title) {
      filters.product_name = new RegExp(title, "i");
    }

    if (priceMin) {
      filters.product_price = { $gte: Number(priceMin) };
    }

    if (priceMax) {
      if (filters.product_price) {
        filters.product_price.$lte = Number(priceMax);
      } else {
        filters.product_price = { $lte: Number(priceMax) };
      }
    }

    // Check if a sort preference sent in query, if yes add a new key to the object sortMethod
    const sortMethod = {};
    if (sort === "price-asc") {
      sortMethod.product_price = 1;
    } else if (sort === "price-desc") {
      sortMethod.product_price = -1;
    }

    // Check if a limit is sent is query, if not default
    let limitChosen = 5;
    if (limit) {
      limitChosen = Number(limit);
    }

    //Check if a page number is sent, if not default page 1 (skip = 0), if yes calculate skip
    let skip = 0;
    if (page > 0) {
      skip = (Number(page) - 1) * limitChosen;
    }

    // Find the results according to the filters, sorting method and pagination
    const results = await Offer.find(filters)
      .sort(sortMethod)
      .skip(skip)
      .limit(limitChosen)
      .populate("owner", "-salt -hash -token");

    // Check if the page number is valid (<= to the total number of pages of the research) & respond to the client
    const numberOfResults = await Offer.countDocuments(filters);
    const numMaxOfPages = Math.ceil(numberOfResults / limitChosen);
    let pageNumber = 1;
    if (page) {
      pageNumber = Number(page);
    }
    if (pageNumber <= numMaxOfPages) {
      res.status(200).json({ count: numberOfResults, offers: results });
    } else {
      res.status(404).json({ message: "This page doesn't exist." });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to show infos about an offer based on its ID (last offer route)
router.get("/offer/:id", async (req, res) => {
  try {
    if (req.params.id) {
      const offer = await Offer.findById(req.params.id).populate({
        path: "owner",
        select: "-token -hash -salt -email -__v",
      });
      if (offer) {
        res.status(200).json(offer);
      } else {
        res.status(400).json({ message: "This offer doesn't exist." });
      }
    } else {
      res.status(400).json({ message: "Please provide an ID." });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Export the routes
module.exports = router;
