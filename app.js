//jshint esversion:6
require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const encrypt = require("mongoose-encryption");

const app = express();

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
mongoose.connect('mongodb://localhost:27017/userDB', { useNewUrlParser: true }); //we use the local mongoDB and remove the warning


//with mongoose encryption we modify the schema
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
  });

// const secret = "thisisourlittlesecret."; //see how cipher works
userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ["password"]});//we place this before the mongoose.model
//mongoose will encrypt when we save our file and decrypt when we call the find method


const User = new mongoose.model('User', userSchema);

app.get('/home', function (req, res) {
  res.render('home');
});

app.get('/login', function (req, res) {
  res.render('login');
});

app.get('/register', function (req, res) {
  res.render('register');
});

app.post('/register', function (req, res) {
  const newUser = new User({
    email: req.body.username,
    password: req.body.password,
  });

  newUser.save(function (err) {
    if (err) {
      console.log(err);
    } else {
      res.render('secrets');
    }
  });
});

app.post('/login', function (req, res) {
  const username = req.body.username;
  const password = req.body.password;

  User.findOne({ email: username }, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        if (foundUser.password === password) {
          res.render('secrets');
        }
      }
    }
  });
});

app.listen(3000, function (req, res) {
  console.log('App running on port 3000');
});
