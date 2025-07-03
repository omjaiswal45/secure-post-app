
const express = require("express");
const app = express();
require("dotenv").config();
const nodemailer = require("nodemailer");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("./models/user");
const postModel = require("./models/post");
const path = require("path");
const crypto = require("crypto");
const upload = require("./config/multerconfig");

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/forgot", (req, res) => {
  res.render("forgot");
});

app.post("/forgot", async (req, res) => {
  const { email } = req.body;
  const user = await userModel.findOne({ email });

  if (!user) return res.send("No user with this email found.");

  const token = crypto.randomBytes(32).toString("hex");
  user.resetToken = token;
  user.resetTokenExpiry = Date.now() + 3600000;
  await user.save();

  const resetLink = `http://localhost:3000/reset/${token}`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: "Reset Your Password",
    html: `<h2>Reset Password</h2><p>Click below link:</p><a href="${resetLink}">${resetLink}</a>`
  });

  res.send("Reset link sent to your email.");
});
// reset page--------------------------------------------------------------------------------------------------------
app.get("/reset/:token", async (req, res) => {
  const user = await userModel.findOne({
    resetToken: req.params.token,
    resetTokenExpiry: { $gt: Date.now() }
  });

  if (!user) return res.send("Token expired or invalid.");

  res.render("reset", { token: req.params.token });
});
// reset post page--------------------------------------------------------------------------------------------------------
app.post("/reset/:token", async (req, res) => {
  const user = await userModel.findOne({
    resetToken: req.params.token,
    resetTokenExpiry: { $gt: Date.now() }
  });

  if (!user) return res.send("Token expired or invalid.");

  const hashed = await bcrypt.hash(req.body.password, 10);
  user.password = hashed;
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();

  res.redirect("/login");
});
// profilepicimages  page--------------------------------------------------------------------------------------------------------
app.get("/uploadprofileimage/:id", authenticateToken , async (req, res) => {
   const user = await userModel.findOne({ email: req.user.email });
  res.render("uploadprofileimage", { user });
});
// upload POST  profile image page--------------------------------------------------------------------------------------------------------
app.post("/uploadprofile/:id", authenticateToken, upload.single("image"), async (req, res) => {
  let user = await userModel.findOne({email: req.user.email });
  user.profilepic = req.file.filename;
  await user.save();
  res.redirect("/profile");
});
// login page--------------------------------------------------------------------------------------------------------
app.get("/login", (req, res) => {
  res.render("login");
});
// login post  page--------------------------------------------------------------------------------------------------------
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await userModel.findOne({ email });

  if (!user) return res.status(400).send({ message: "Invalid email or password" });

  bcrypt.compare(password, user.password, (err, result) => {
    if (!result) return res.status(400).send({ message: "Invalid email or password" });
    const token = jwt.sign({ email: email, userid: user._id }, "shhhh");
    res.cookie("token", token);
    res.redirect("/profile");
  });
});
// register page--------------------------------------------------------------------------------------------------------
app.post("/register", async (req, res) => {
  const { username, name, password, email, age } = req.body;
  let existingUser = await userModel.findOne({ email });

  if (existingUser) return res.status(400).send({ message: "User already exists" });

  bcrypt.genSalt(10, async (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      const user = await userModel.create({ username, name, password: hash, email, age });
      const token = jwt.sign({ email: email, userid: user._id }, "shhhh");
      res.cookie("token", token);
      res.redirect("/profile");
    });
  });
});
// profile page--------------------------------------------------------------------------------------------------------
app.get("/profile", authenticateToken, async (req, res) => {
  const user = await userModel.findOne({ email: req.user.email });
  const posts = await postModel.find({ user: user._id }).populate("user");
  res.render("profile", { user, posts });
});
// logout--------------------------------------------------------------------------------------------------------
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});
// create a new post--------------------------------------------------------------------------------------------
app.post("/post", authenticateToken, async (req, res) => {
  const user = await userModel.findOne({ email: req.user.email });
  const { title, content } = req.body;
  const post = await postModel.create({ title, content, user: user._id });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});
//count likes for a post--------------------------------------------------------------------------------------------
app.get('/like/:id', authenticateToken, async (req, res) => {
  let post = await postModel.findOne({_id: req.params.id}).populate('user');
  const index = post.likes.indexOf(req.user.userid);
  if(index === -1){
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(index, 1);
  }
  await post.save();
  res.redirect('/profile');
});
//edit a post--------------------------------------------------------------------------------------------
app.get('/edit/:id', authenticateToken, async (req, res) => {
  let post = await postModel.findOne({_id: req.params.id}).populate('user');
  res.render('edit', {post});
});
// update a post--------------------------------------------------------------------------------------------
app.post('/update/:id', authenticateToken, async (req, res) => {
  await postModel.findOneAndUpdate({_id: req.params.id}, { title: req.body.title, content: req.body.content }, { new: true });
  res.redirect('/profile');
});
// delete a post--------------------------------------------------------------------------------------------

app.get('/delete/:id', authenticateToken, async (req, res) => {
  await postModel.deleteOne({_id: req.params.id});
  res.redirect('/profile');
});
// middlewares for authentication-------------------------------------------------------------------------

function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");

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
