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
    const {
      description,
      title,
      price,
      condition,
      city,
      brand,
      size,
      color,
      picture,
    } = req.fields;

    if (description.length <= 500 && title.length <= 50 && price <= 100000) {
      // Create the new offer
      const newOffer = new Offer({
        product_name: title,
        product_description: description,
        product_price: price,
        product_details: [
          { MARQUE: brand },
          { TAILLE: size },
          { ÉTAT: condition },
          { COULEUR: color },
          { EMPLACEMENT: city },
        ],
        owner: req.user,
      });

      // Upload the picture to Cloudinary
      if (picture) {
        const pictureOffer = picture.path;
        let result = await cloudinary.uploader.upload(pictureOffer, {
          folder: `/vinted/offers/${newOffer._id}`,
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
router.delete("/offer/delete/:id", isAuthenticated, async (req, res) => {
  try {
    // Check if ID corresponds to an offer
    const offerToDelete = await Offer.findById(req.params.id);

    if (offerToDelete) {
      // check if the token of the user trying to delete offer === token user who posted the offer
      const user = await User.findById(offerToDelete.owner._id);
      const token = req.headers.authorization.replace("Bearer ", "");
      if (token === user.token) {
        // Delete image from Cloudify
        await cloudinary.api.delete_resources_by_prefix(
          `vinted/offers/${req.params.id}`
        );

        // Delete folder from Cloudinary
        await cloudinary.api.delete_folder(`vinted/offers/${req.params.id}`);

        // Delete offer from DB
        await offerToDelete.delete();

        // Respond to client
        res.status(200).json({ message: "Offer successfully deleted." });
      } else {
        return res.status(401).json({ error: "Unauthorized" });
      }
    } else {
      res.status(400).json({ message: "This offer doesn't exist." });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to update an offer
router.put("/offer/update/:id", isAuthenticated, async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      brand,
      size,
      condition,
      color,
      city,
    } = req.fields;
    // Check if ID corresponds to an offer
    const offerToUpdate = await Offer.findById(req.params.id);
    if (offerToUpdate) {
      // check if the token of the user trying to delete offer === token user who posted the offer
      const user = await User.findById(offerToUpdate.owner._id);
      const token = req.headers.authorization.replace("Bearer ", "");
      if (token === user.token) {
        // Update the document
        if (title) {
          offerToUpdate.product_name = title;
        }

        if (description) {
          offerToUpdate.product_description = description;
        }

        if (price) {
          offerToUpdate.product_price = price;
        }

        const productDetails = offerToUpdate.product_details;
        for (let i = 0; i < productDetails.length; i++) {
          if (productDetails[i].MARQUE) {
            if (brand) {
              productDetails[i].MARQUE = brand;
            }
          }

          if (productDetails[i].TAILLE) {
            if (size) {
              productDetails[i].TAILLE = size;
            }
          }

          if (productDetails[i].ÉTAT) {
            if (condition) {
              productDetails[i].ÉTAT = condition;
            }
          }

          if (productDetails[i].COULEUR) {
            if (color) {
              productDetails[i].COULEUR = color;
            }
          }

          if (productDetails[i].EMPLACEMENT) {
            if (city) {
              productDetails[i].EMPLACEMENT = city;
            }
          }
        }

        if (req.files.picture) {
          // Delete previous picture from Cloudinary
          await cloudinary.api.delete_resources_by_prefix(
            `vinted/offers/${req.params.id}`
          );
          // Add new picture in the folder
          const result = await cloudinary.uploader.upload(req.files.path, {
            folder: `/vinted/offers/"${req.params.id}`,
          });
          // Modify infos about picture in the document
          offerToUpdate.product_image = result;
        }

        await offerToUpdate.save();
        // Respond to the client
        res.status(200).json({ message: "Offer successfully modified" });
      } else {
        res.status(400).json({ error: "Unauthorized" });
      }
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
