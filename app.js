//jshint esversion:6
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session'); //#1
const passport = require('passport'); //#2
const passportLocalMongoose = require('passport-local-mongoose'); //#3 but passport-local don't need to be required but it will be needed by passportLocalMongoose
//Explanation 1: we first require the three packages
const GoogleStrategy = require('passport-google-oauth20').Strategy; //Google 1
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

//Explanation 2: We set up sessions to have a secret
app.use(
  session({
    secret: 'Our little secret.',
    resave: false,
    saveUninitialized: false, //read the doc and search for each key to see why we changed this to false for example
  })
);

//Explanation 3: We initialize passport and we use passport to manage our sessions
app.use(passport.initialize()); //this method comes with passport to start with the authentication
app.use(passport.session()); //we tell passport to set up our session

//Google 2: replace with details you got from Google
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.client_ID,
      clientSecret: process.env.client_SECRET,
      callbackURL: 'http://localhost:3000/auth/google/secrets',
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo', //we're retrieving teh user's profile info from Google+ but rather from their user info
      //taken from github: https://github.com/jaredhanson/passport-google-oauth2/pull/51
    },
    //the following is a callback with the accessToken(to access the user data for a longer time), profile,ect
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      //findOrCreate is not a method (you have to create a function to find or create)
      //but there are some guys who created an npm function for findOrCreate
      //npm i mongoose-findorcreate
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

mongoose.connect('mongodb://localhost:27017/userDB', { useNewUrlParser: true }); //we use the local mongoDB and remove the warning
mongoose.set('useCreateIndex', true); //to remove the warning when using passport local mongoose

//with mongoose encryption we modify the schema
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String, //Google 7 to add them in our DB
  secret: String,
});
//the schema must be a mongoose schema in order to have a plugin
//Explanation 4: we set up our userSchema to use passportLocalMongoose as a plugin (to hash and salt our password)
userSchema.plugin(passportLocalMongoose); //passportLocalMongoose will hash and salt our password
//Google 3: we set the schema to use findOrCreate
userSchema.plugin(findOrCreate);

const User = new mongoose.model('User', userSchema);

//Now we can config the passport local config under the schema that mongoose will use
//Explanation 5: we use passport local mongoose to create a local login strategy
passport.use(User.createStrategy());

//passport.serializeUser(User.serializeUser()); //and we set passport to serialize and deserialize our user
//passport.deserializeUser(User.deserializeUser());
//only these three codes will do the heavy lifting thanks to passport local mongoose, without it we would be writing lots of codes
//The above serialisation is replaced by the following one coz it does not only the local but also external with google for example
//Google 6: get these passport de/serialisation
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

app.get('/', function (req, res) {
  res.render('home');
});

//Google 4: the sign up button with google takes the user to this route
app.get(
  '/auth/google',
  //we use passport to authenticate the user, not locally this time, but with google
  passport.authenticate('google', { scope: ['profile'] }) //read doc. Profile include the email and profile
);
//Google 5: for redirection after being authenticated by google
app.get(
  '/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets'); //redirect to succesful page
  }
);

app.get('/login', function (req, res) {
  res.render('login');
});

app.get('/register', function (req, res) {
  res.render('register');
});

//we no loger authenticate here since this page should be seen by the public
app.get("/secrets", function (req, res) {
    //Now we will pull out all the secret fields that has a value(where field is not null)
    User.find({"secret": {$ne: null}}, function(err, foundUser){
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                res.render("secrets", {userWithSecrets: foundUser})
            }
        }
    });
});
//with passport we can now safely create a "/secrets" route coz it'll check if the user is authenticated
app.get('/submit', function (req, res) {
  if (req.isAuthenticated()) {
    res.render('submit');
  } else {
    res.redirect('/login');
  }
});

app.post('/submit', function (req, res) {
  const submittedSecret = req.body.secret;
  //how do we know who the current user is?passport saves the user's details in the request when a new login session is initiated
  console.log(req.user.id);
  User.findById(req.user.id, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(function () {
          res.redirect('/secrets');
        });
      }
    }
  });
});

app.get('/logout', function (req, res) {
  //we will deauthenticate. See the passport website doc with each method
  req.logout();
  res.redirect('/');
});

app.post('/register', function (req, res) {
  //Explanation 6:Now we will use the passportLocalMongoose. Passport will help us with its register method
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect('/register');
      } else {
        passport.authenticate('local')(req, res, function () {
          res.redirect('/secrets');
        });
      }
    }
  );
});

app.post('/login', function (req, res) {
  //Here passport will also help us to log in using its login method
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate('local')(req, res, function () {
        res.redirect('/secrets');
      });
    }
  });
});

app.listen(3000, function (req, res) {
  console.log('App running on port 3000');
});
