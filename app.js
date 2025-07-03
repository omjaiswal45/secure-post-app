const express = require("express");
const app = express();

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

// Home route
app.get("/", (req, res) => {
  res.render("index");
});

//uploadprofileimage
app.get("/uploadprofileimage/:id", authenticateToken , async (req, res) => {
   const user = await userModel.findOne({ email: req.user.email });
  res.render("uploadprofileimage", { user });
});

// upload profile image handler
app.post("/uploadprofile/:id", authenticateToken, upload.single("image"), async (req, res) => {
let user = await userModel.findOne({email: req.user.email });
  user.profilepic = req.file.filename;
  await user.save();
  res.redirect("/profile");
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
  res.redirect("/");
});

// Create Post
app.post("/post", authenticateToken, async (req, res) => {
  const user = await userModel.findOne({ email: req.user.email });
  const { title, content } = req.body;

  const post = await postModel.create({ title, content, user: user._id });
  user.posts.push(post._id);
  await user.save();

  res.redirect("/profile"); // Redirect to profile
});

//likes a post
app.get('/like/:id', authenticateToken, async (req, res) => {
  let post = await postModel.findOne({_id: req.params.id}).populate('user');
  if(post.likes.indexOf(req.user.userid)=== -1){
    post.likes.push(req.user.userid);
    await post.save();}
  else{
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
    await post.save();
  }
  res.redirect('/profile');
})

//edit a post
app.get('/edit/:id', authenticateToken, async (req, res) => {
   let post = await postModel.findOne({_id: req.params.id}).populate('user');
   res.render('edit', {post});
})
  
//udate a post
app.post('/update/:id', authenticateToken, async (req, res) => {
   let post = await postModel.findOneAndUpdate({_id: req.params.id}, { title: req.body.title, content: req.body.content },
  { new: true });
   res.redirect('/profile');
});

//delete a post
app.get('/delete/:id', authenticateToken, async (req, res) => {
   await postModel.deleteOne({_id: req.params.id});
   res.redirect('/profile');
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
