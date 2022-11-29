require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require("jsonwebtoken");

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

// Verify json web token
const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.JWT_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
  });
  next();
};

async function run() {
  try {
    const categories = client.db("Gamicon").collection("categories");
    const userCollection = client.db("Gamicon").collection("users");
    const productCollection = client.db("Gamicon").collection("products");
    const bookingCollection = client.db("Gamicon").collection("bookings");
    const paymentCollection = client.db("Gamicon").collection("payments");

    // Verify seller
    const verifySeller = async (req, res, next) => {
      const email = req.query.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      if (user?.role !== "seller") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

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
    app.post("/products", verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });

    // Get a specific user products data
    app.get("/products", async (req, res) => {
      const email = req.query.email;
      const filter = { sellerEmail: email };
      const result = await productCollection.find(filter).toArray();
      res.send(result);
    });

    // delete a product data
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await productCollection.deleteOne(filter);
      res.send(result);
    });

    //update product advertise status
    app.patch("/products-advertise/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: { advertised: true },
      };

      const result = await productCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // get all advertised products
    app.get("/advertised-products", async (req, res) => {
      const filter = { advertised: true, salesStatus: "available" };
      const result = await productCollection.find(filter).toArray();
      res.send(result);
    });

    // Get specific category data
    app.get("/categories/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { category_id: id, salesStatus: "available" };
      const result = await productCollection.find(filter).toArray();
      res.send(result);
    });

    // update product report
    app.patch("/report/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: { report: true },
      };
      const result = await productCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // get all reported products
    app.get("/reported-items", async (req, res) => {
      const filter = { report: true };
      const result = await productCollection.find(filter).toArray();
      res.send(result);
    });

    // get all seller data
    app.get("/allseller", async (req, res) => {
      const filter = { role: "seller" };
      const result = await userCollection.find(filter).toArray();
      res.send(result);
    });

    // get all buyer data
    app.get("/allbuyer", verifyJwt, async (req, res) => {
      const filter = { role: "buyer" };
      const result = await userCollection.find(filter).toArray();
      res.send(result);
    });

    // delete a seller
    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    });

    // Add booking data to database
    app.post("/bookings", verifyJwt, async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // Get a specific user bookings data
    app.get("/bookings", verifyJwt, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const filter = { buyerEmail: email };
      const result = await bookingCollection.find(filter).toArray();
      res.send(result);
    });

    // Verify user
    app.patch("/verify-user", verifyJwt, async (req, res) => {
      const email = req.query.email;

      const userFilter = { email: email };
      const userUpdateDoc = {
        $set: { verified: true },
      };
      const userResult = await userCollection.updateOne(
        userFilter,
        userUpdateDoc
      );

      // product
      const productFilter = { sellerEmail: email };
      const productUpdateDoc = {
        $set: { sellerVerification: true },
      };
      const productResult = await productCollection.updateMany(
        productFilter,
        productUpdateDoc
      );
      res.send(userResult);
    });

    // Add payements to db
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);

      res.send(result);
    });

    // update booking and product sales staus
    app.patch("/update-sale-status", async (req, res) => {
      const productId = req.query.productId;

      // booking sale status
      const bookingFilter = { productId: productId };
      const updateDocBooking = {
        $set: { salesStatus: "sold" },
      };
      const bookingResult = await bookingCollection.updateMany(
        bookingFilter,
        updateDocBooking
      );

      // product sale status
      const productFilter = { _id: ObjectId(productId) };
      const updateDocProduct = {
        $set: { salesStatus: "sold" },
      };
      const result = await productCollection.updateOne(
        productFilter,
        updateDocProduct
      );
      res.send(result);
    });

    // Json web token
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      if (!user) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: "10d" });
      res.send({ token });
    });

    // Stripe
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = parseInt(booking.price);
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Gamicon server is ruuning on port ${port}`);
});
