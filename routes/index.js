var express = require('express');
var router = express.Router();
const userModel = require('./users');
const postModel = require('./posts');
const passport = require('passport');
const upload = require('./multer');
const fs = require('fs');
const path = require('path');

const localStrategy = require('passport-local');
passport.use(new localStrategy(userModel.authenticate()));

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

router.get('/login', function(req, res, next) {
  res.render('login', {error: req.flash('error')});
});

router.get('/feed', function(req, res, next) {
  res.render('feed');
});

router.post('/upload', isLoggedIn, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const absolutePath = path.resolve(req.file.path);
    console.log(`File saved to: ${absolutePath}`); // Debug

    // Verify file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error('File was not saved correctly');
    }

    const user = await userModel.findById(req.user._id);
    if (!user) {
      // Clean up the file if user not found
      fs.unlinkSync(absolutePath);
      return res.status(404).json({ error: 'User not found' });
    }

    const post = await postModel.create({
      image: req.file.filename,
      imageText: req.body.filecaption,
      user: user._id
    });

    user.posts.push(post._id);
    await user.save();

    res.redirect('/profile');
  } catch (err) {
    console.error('Upload error:', err);
    if (req.file) {
      const absolutePath = path.resolve(req.file.path);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
    next(err);
  }
});

router.get('/profile', isLoggedIn, async function(req, res, next) {
  try {
    const user = await userModel.findOne({ _id: req.user._id })
                              .populate({
                                path: 'posts',
                                options: { sort: { createdAt: -1 } } // Newest first
                              });
    
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/login');
    }
    
    console.log('User with populated posts:', user); // Debug
    res.render("profile", { user });
  } catch (err) {
    next(err);
  }
});

router.post('/register', function(req, res, next) {
  const { username, email, fullname } = req.body;
  const userData = new userModel({ username, email, fullname });

  userModel.register(userData, req.body.password, function(err) {
    if (err) {
      req.flash('error', err.message);
      return res.redirect('/register'); // Assuming you have a register page
    }
    passport.authenticate("local")(req, res, function() {
      res.redirect('/profile');
    });
  });
});

router.post('/login', passport.authenticate("local", {
  successRedirect: '/profile',
  failureRedirect: '/login',
  failureFlash: true,
}));

router.get('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

module.exports = router;