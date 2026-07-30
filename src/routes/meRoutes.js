const express = require("express");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  res.json({
    message: "You are authenticated",
    auth: req.auth,
  });
});

module.exports = router;
