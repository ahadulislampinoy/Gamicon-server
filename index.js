const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Middlewares
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Gamicon server is running");
});

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.5a1umhj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const categories = client.db("Gamicon").collection("categories");
    const userCollection = client.db("Gamicon").collection("users");
    const productCollection = client.db("Gamicon").collection("products");

    // Get categories data
    app.get("/categories", async (req, res) => {
      const query = {};
      const result = await categories.find(query).toArray();
      res.send(result);
    });

    // Add user to database
    app.post("/users", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const userExist = await userCollection.findOne(query);
      if (userExist) {
        return;
      }
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Get user role
    app.get("/users", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // Add product data to database
    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });

    // Get products data
    app.get("/products", async (req, res) => {
      const query = {};
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Gamicon server is ruuning on port ${port}`);
});
