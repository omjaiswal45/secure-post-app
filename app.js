const express = require("express");
const app = express();

const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("./models/user");
const postModel = require("./models/post");
const path = require("path");

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Home route
app.get("/", (req, res) => {
  res.render("index");
});

// Login Page
app.get("/login", (req, res) => {
  res.render("login");
});

// Login Handler
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await userModel.findOne({ email });

  if (!user) {
    return res.status(400).send({ message: "Invalid email or password" });
  }

  bcrypt.compare(password, user.password, (err, result) => {
    if (!result) {
      return res.status(400).send({ message: "Invalid email or password" });
    } else {
      const token = jwt.sign({ email: email, userid: user._id }, "shhhh");
      res.cookie("token", token);
      res.redirect("/profile");
    }
  });
});

// Registration Handler
app.post("/register", async (req, res) => {
  const { username, name, password, email, age } = req.body;
  let existingUser = await userModel.findOne({ email });

  if (existingUser) {
    return res.status(400).send({ message: "User already exists" });
  }

  bcrypt.genSalt(10, async (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      const user = await userModel.create({
        username,
        name,
        password: hash,
        email,
        age,
      });
      const token = jwt.sign({ email: email, userid: user._id }, "shhhh");
      res.cookie("token", token);
      res.redirect("/profile");
    });
  });
});

// Profile Page with Posts
app.get("/profile", authenticateToken, async (req, res) => {
  const user = await userModel.findOne({ email: req.user.email });
  const posts = await postModel.find({ user: user._id }).populate("user");

  res.render("profile", { user, posts });
});

// Logout
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.send("User logged out successfully");
});

// Create Post
app.post("/post", authenticateToken, async (req, res) => {
  const user = await userModel.findOne({ email: req.user.email });
  const { title, content } = req.body;

  const post = await postModel.create({ title, content, user: user._id });
  user.posts.push(post._id);
  await user.save();

  res.redirect("/profile"); // Redirect to profile instead of /post
});

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect("/login");
  }

  try {
    const data = jwt.verify(token, "shhhh");
    req.user = data;
    next();
  } catch (err) {
    return res.status(403).send("Invalid or expired token.");
  }
}

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
