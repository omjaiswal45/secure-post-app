const mongoose = require ('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/miniauthpost');

const userSchema = mongoose.Schema({
  username:String ,
  name: String ,
  password: String ,
  email: String ,
  age: Number,
  posts: [{type: mongoose.Schema.Types.ObjectId, ref: 'Post'}] // references to posts created by this user

});
module.exports = mongoose.model('User', userSchema);
