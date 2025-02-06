const db = require("../db");
const axios = require("axios");
const { escape } = require("mysql2");  // For SQL escaping

const queryDatabase = async (queryText) => {
  return new Promise((resolve, reject) => {
    let sql = "";

    // Handle product comparison query
    if (queryText.toLowerCase().includes("compare")) {
      // Extract the product names to compare (e.g., "Compare product X1 and product Y1")
      const products = queryText.match(/product\s+([a-zA-Z0-9\s]+)\s+and\s+([a-zA-Z0-9\s]+)/i);
      
      if (products && products.length > 2) {
        const product1 = products[1].trim();
        const product2 = products[2].trim();
        console.log(`Products to Compare: ${product1} and ${product2}`);

        // Generate SQL query to fetch data for both products
        sql = `SELECT * FROM products WHERE name IN ('${product1}', '${product2}')`;
      } else {
        return resolve("Please specify two products to compare.");
      }
    }
    // Other query conditions like showing products under a brand, etc.
    else if (queryText.toLowerCase().includes("show me all products under brand")) {
      const brand = queryText.split("brand ")[1];
      sql = `SELECT * FROM products WHERE brand = '${brand}'`;
    }
    else if (queryText.toLowerCase().includes("which suppliers provide")) {
      const category = queryText.split("provide ")[1];
      sql = `SELECT * FROM suppliers WHERE product_categories LIKE '%${category}%'`;
    }
    else if (queryText.toLowerCase().includes("give me details of product")) {
      const productName = queryText.split("product ")[1];
      sql = `SELECT * FROM products WHERE name = '${productName}'`;
    } else {
      return resolve("Sorry, I didn't understand that. Please rephrase.");
    }

    console.log("SQL Query: ", sql);  // Log the SQL query being generated

    db.query(sql, (err, results) => {
      if (err) reject(err);
      console.log("Database Results: ", results);  // Log the results from the database

      // If it's a product comparison, return the comparison response
      if (queryText.toLowerCase().includes("compare")) {
        resolve(compareProducts(results));
      } else {
        resolve(results.length ? results : "No data found.");
      }
    });
  });
};

// Function to compare two products
const compareProducts = (products) => {
  if (products.length !== 2) {
    return "Unable to compare. Make sure you are comparing exactly two products.";
  }

  const product1 = products[0];
  const product2 = products[1];

  let comparison = `
    **Product Comparison**:

    1. **${product1.name}** (${product1.brand})
      - **Price**: $${product1.price}
      - **Description**: ${product1.description}
      
    2. **${product2.name}** (${product2.brand})
      - **Price**: $${product2.price}
      - **Description**: ${product2.description}
  `;
  return comparison;
};


// Function to enhance responses with an LLM
const enhanceWithLLM = async (data) => {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
      { inputs: JSON.stringify(data) },
      {
        headers: { Authorization: `Bearer ${process.env.HF_API_KEY}` },
      }
    );
    return response.data[0]?.summary_text || data;
  } catch (error) {
    console.error("LLM API Error:", error);
    return "Sorry, I couldn't enhance the response at this moment.";
  }
};

// Main chatbot handler
exports.chatbotResponse = async (req, res) => {
  const { userQuery } = req.body;
  try {
    const dbResult = await queryDatabase(userQuery);
    const enhancedResponse = await enhanceWithLLM(dbResult);
    res.json({ response: enhancedResponse });
  } catch (error) {
    console.error("Chatbot error:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
};
