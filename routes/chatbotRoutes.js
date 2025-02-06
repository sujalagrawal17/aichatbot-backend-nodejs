const express = require("express");
const { chatbotResponse } = require("../controllers/chatbotController");
const router = express.Router();

router.post("/chat", chatbotResponse);

module.exports = router;
