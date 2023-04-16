const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socketio = require("socket.io");
const io = socketio(server);
const hbs = require("hbs");
const session = require("express-session");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { Calendar } = require("node-calendar-js");
const crypto = require("crypto");
const { promisify } = require("util");
const randomBytes = promisify(crypto.randomBytes);
const db = require("./src/db/db");
const Register = require("./src/models/user");
const Tasks = require("./src/models/tasks");
const Timeline = require("./src/models/timeline");
const CheckList = require("./src/models/checklist");
const Chat = require("./src/models/chat");
const auth = require("./src/middleware/auth");
const logKey = process.env.SEC_KEY_SES;
const formatMessage = require("./src/users/messages");
const createAdapter = require("@socket.io/redis-adapter").createAdapter;
const redis = require("redis");
const cliId = process.env.CLIID;
const cliSec = process.env.CLISEC;
const rfTk = process.env.RFTK;
const accTk = process.env.ACCTK;
const gmUser = process.env.EMAIL;
const gmPass = process.env.PASS;
const PORT = process.env.PORT || 4501;
const BUCKET = process.env.BUCKET;
const path = require("path");
const static_path = path.join(__dirname, "./public");
const template_path = path.join(__dirname, "./template/views");
const partials_path = path.join(__dirname, "./template/partials");
const helper_path = path.join(__dirname, "./template/helpers");

app.set("view engine", "hbs");
app.set("views", template_path);
app.use(express.static(static_path));
hbs.registerPartials(partials_path);

hbs.registerHelper("ifeqday", function (a, b, options) {
  if (a == b) {
    return this.name;
  }
});

hbs.registerHelper("ifinc", function (a) {
  if (a >= 0) {
    const b = a + 1;
    console.log(b);
    return new handlebars.SafeString("{{" + b + ".task}}");
  }
});

hbs.registerHelper("ifeqdate", function (a, b, options) {
  if (a == b) {
    return this.day;
  }
});

const { createClient } = redis;
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require("./src/users/users");

const botName = "Dost Bot";

io.on("connection", (socket) => {
  console.log(io.of("/").adapter);
  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    // Welcome current user
    socket.emit("message", formatMessage(botName, "Welcome to Dost Community!"));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  // Listen for chatMessage
  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(user.username, msg));
  });

  // Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

// //Express Body Parser MIDDLEWARE

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// AWS BUCKET WITH MULTER

aws.config.update({
  secretAccessKey: process.env.SEC_KEY_AWS,
  accessKeyId: process.env.ACC_KEY,
  region: process.env.REGION,
});

const s3 = new aws.S3();

async function generateUploadURL() {
  const rawBytes = await randomBytes(16);
  const imageName = rawBytes.toString("hex");

  const params = {
    Bucket: BUCKET,
    Key: imageName,
  };

  const uploadURL = await s3.getSignedUrlPromise("putObject", params);
  return uploadURL;
}

app.get("/s3Url", async (req, res) => {
  const url = await generateUploadURL();
  res.send({ url });
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: BUCKET,
    key: function (req, file, cb) {
      console.log(file);
      cb(null, file.originalname);
    },
  }),
});

app.use(cookieParser());

// // Express session

app.use(
  session({
    key: "flash_sid",
    secret: logKey,
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: null },
  })
);

// // Flash messages middleware

app.use((req, res, next) => {
  res.locals.message = req.session.message;
  delete req.session.message;
  next();
});

app.use((req, res, next) => {
  res.locals.data = req.session.data;
  delete req.session.data;
  next();
});

app.use((req, res, next) => {
  res.locals.adminData = req.session.adminData;
  delete req.session.adminData;
  next();
});

app.use((req, res, next) => {
  res.locals.memberattasks = req.session.memberattasks;
  delete req.session.memberattasks;
  next();
});

// // Navigation Bar Middleware Variable that will determine whether "Login" or "Logout" will appeare.

const logData = { loggedIn: false, errorComment: "Page cannot be found" };

// Navigation Bar Middleware Variable that will determine whether "Admin" or "Member" will appeare.

const adminData = { adminIn: false, errorComment: "Page cannot be found" };

// Username fetcing form database and sending to hbs

const user = { loggedIn: false, username: "None" };

const members = { loggedIn: false, member: "none" };

const memberattasks = { loggedIn: false, members: "none" };

const calendar = new Calendar({
  year: Date.now.year,
  month: 0,
});

const calHtml = calendar.toJSON();

const calendarTimeline = {
  calendar: calHtml,
  username: "",
  about: "",
  department: "",
  memberoradmin: "",
};

// //ROUTES

app.get("/", (req, res) => {
  res.render("index.hbs")
});

app.get("/Login", (req, res) => {
  res.render("login.hbs");
});

app.get("/Rooms", auth, (req, res) => {
  if (req.cookies.keyrem) {
    if (req.cookies.user) {
      user.username = req.cookies.user;
      user.loggedIn = true;
      res.render("rooms.hbs", user);
    }
  } else {
    user.loggedIn = false;
    res.render("login.hbs", logData);
  }
});

app.get("/Chat", (req, res) => {
  if(req.cookies.keyrem) {
    logData.loggedIn = true;
    res.render("chat.hbs", logData);
  } else {
    logData.loggedIn = false;
    res.render("chat.hbs", logData);
  }
});

app.get("/Files/List/Financials", async (req, res) => {
  let r = await s3
    .listObjectsV2({ Bucket: BUCKET, Prefix: "Financials/" })
    .promise();
  let x = r.Contents.map((item) => item.Key);

  for (let i = 0; i < x.length; i++) {
    let a = x[i].split("Financials/");
    a.splice(2, 2);
    x[i] = a.join("Financials%2f");
  }

  req.session.data = {
    type: "Success",
    message: x,
  };
  res.redirect("/Files");
  delete req.session.data;
});

app.get("/Files/List/Images", async (req, res) => {
  let r = await s3
    .listObjectsV2({ Bucket: BUCKET, Prefix: "Images/" })
    .promise();
  let x = r.Contents.map((item) => item.Key);

  for (let i = 0; i < x.length; i++) {
    let a = x[i].split("Images/");
    a.splice(2, 2);
    x[i] = a.join("Images%2f");
  }

  req.session.data = {
    type: "Success",
    intro: "Images",
    message: x,
  };
  res.redirect("/Files");
  delete req.session.data;
});

app.get("/Files/List/Assets", async (req, res) => {
  let r = await s3
    .listObjectsV2({ Bucket: BUCKET, Prefix: "Assets/" })
    .promise();
  let x = r.Contents.map((item) => item.Key);

  for (let i = 0; i < x.length; i++) {
    let a = x[i].split("Assets/");
    a.splice(2, 2);
    x[i] = a.join("Assets%2f");
  }

  req.session.data = {
    type: "Success",
    intro: "Assets",
    message: x,
  };
  res.redirect("/Files");
  delete req.session.data;
});


app.get("/List", async (req, res) => {
    let r = await s3.listObjectsV2({ Bucket: BUCKET }).promise();
    let x = r.Contents.map((item) => item.Key);

    req.session.data = {
      type: "Success",
      intro: "Assets",
      message: x,
    };
    res.redirect("/Files");
    delete req.session.data;
});

app.get("/Admin/List", async (req, res) => {
  let r = await s3.listObjectsV2({ Bucket: BUCKET }).promise();
  let x = r.Contents.map((item) => item.Key);

  req.session.data = {
    type: "Success",
    type: "Assets",
    message: x,
  };
  res.redirect("/Admin");
  delete req.session.data;
});

app.get("/Admin/Files/Financials", async (req, res) => {
  let r = await s3
    .listObjectsV2({ Bucket: BUCKET, Prefix: "Financials/" })
    .promise();
  let x = r.Contents.map((item) => item.Key);

  for (let i = 0; i < x.length; i++) {
    let a = x[i].split("Financials/");
    a.splice(2, 2);
    x[i] = a.join("Financials%2f");
  }

  req.session.adminData = {
    type: "Success",
    intro: "Financials",
    message: x,
  };
  res.redirect("/Admin");
  delete req.session.adminData;
});

app.get("/Admin/Files/Images", async (req, res) => {
  let r = await s3
    .listObjectsV2({ Bucket: BUCKET, Prefix: "Images/" })
    .promise();
  let x = r.Contents.map((item) => item.Key);

  for (let i = 0; i < x.length; i++) {
    let a = x[i].split("Images/");
    a.splice(2, 2);
    x[i] = a.join("Images%2f");
  }

  req.session.adminData = {
    type: "Success",
    intro: "Images",
    message: x,
  };
  res.redirect("/Admin");
  delete req.session.adminData;
});

app.get("/Admin/Files/Assets", async (req, res) => {
  let r = await s3
    .listObjectsV2({ Bucket: BUCKET, Prefix: "Assets/" })
    .promise();
  let x = r.Contents.map((item) => item.Key);

  for (let i = 0; i < x.length; i++) {
    let a = x[i].split("Assets/");
    a.splice(2, 2);
    x[i] = a.join("Assets%2f");
  }

  req.session.adminData = {
    type: "Success",
    intro: "Assets",
    message: x,
  };
  res.redirect("/Admin");
  delete req.session.adminData;
});

app.get("/Download/:filename", async (req, res) => {
  const filename = req.params.filename;
  let x = await s3.getObject({ Bucket: BUCKET, Key: filename }).promise();
  res.send(x.Body);
});

app.get("/Delete/:filename", async (req, res) => {
  const filename = req.params.filename;
  try {
    await s3.deleteObject({ Bucket: BUCKET, Key: filename }).promise();
    req.session.message = {
      type: "Success",
      message: "File Deleted Successfully",
    };
    res.redirect("/Admin");
  } catch (error) {
    res.send("Error");
  }
});

app.get("/Tasks", auth, async (req, res) => {
  if (req.cookies.keyrem) {

    const id = req.cookies.id;

    const member = await Register.findOne({_id:id }, { username: 1, about: 1, department: 1, memberoradmin: 1, _id: 0 });

    const user = member.username;

    const tasks = await Tasks.find(
      { username: user },
      { task: 1, deadline: 1, _id: 0 }
    );

    calendarTimeline.about = member.about;
    calendarTimeline.department = member.department;
    calendarTimeline.memberoradmin = member.memberoradmin;
    calendarTimeline.username = member.username;
    calendarTimeline.loggedIn = true

    const mergedObject = {
      ...calendarTimeline,
      ...tasks
    };

    console.log(mergedObject)

    res.render("Tasks.hbs", mergedObject);
  } else {
    logData.loggedIn = false;
    res.render("index.hbs");
  }
});

app.get("/Files", auth, (req, res) => {
  if (req.cookies.keyrem) {
    logData.loggedIn = true;
    res.render("Files.hbs", logData);
  } else {
    logData.loggedIn = false;
    res.render("Files.hbs", logData);
  }
});

app.get("/Admin", async (req, res) => {
  const username = req.cookies.user
  const role = await Register.findOne({username: username}, { username: 1, memberoradmin: 1, _id: 0 });
  const member = await Register.find({  }, {username: 1, _id: 0})

  if (req.cookies.keyrem) {
    if (role.memberoradmin === "Admin") {
      members.loggedIn = true;
      members.member = member
      console.log(members);
      res.render("Admin.hbs", members);
    } else {
      logData.loggedIn = false;
      res.render("Admin.hbs", logData);
    }
  } else {
      req.session.message = {
      type: 'Forbidden',
      intro: 'Access Denied',
      message: 'You need to have Admin role to access Admin platform'
    }
    res.redirect('/')
    delete req.session.message
  }
});

app.post("/Login", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const userEmail = await Register.findOne({ email: email });

    if (userEmail) {
      const validpass = await bcrypt.compare(password, userEmail.password);

      if (validpass) {
        const token = await userEmail.generateAuthToken();
        console.log(token);

        const id = await userEmail.id;

        const user = await userEmail.username;

        res.cookie("keyrem", token, {
          expires: new Date(Date.now() + 5000000),
          httpOnly: true,
          secure: true,
        });

        res.cookie("id", id, {
          expires: new Date(Date.now() + 5000000),
          httpOnly: true,
          secure: true,
        });

        res.cookie("user", user, {
          expires: new Date(Date.now() + 5000000),
          httpOnly: true,
          secure: true,
        });

        req.session.message = {
          type: "Success",
          intro: "Login successful ",
          message: "Welcome to Remedies Member only area! Enjoy",
        };
        res.status(201).redirect("/Tasks");
        delete req.session.message;
      } else {
        req.session.message = {
          type: "Danger",
          intro: "Wrong Credentials ",
          message: "Either email or password is not correct",
        };
        res.status(400).redirect("/Login");
        delete req.session.message;
      }
    } else {
      req.session.message = {
        type: "Danger",
        intro: "Email does not exsits ",
        message: "Please use another Email or Register",
      };
      res.redirect("/Login");
      delete req.session.message;
    }
  } catch (err) {
    res.status(400).send(err);
    req.session.message = {
      type: "Backend Problem",
      intro: "Something went wrong ",
      message: "Cannot login please try again later",
    };
    res.redirect("/");
  }
});



app.get("/Logout", auth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter((instance) => {
      return instance.token !== req.token;
    });

    res.clearCookie("keyrem");
    res.clearCookie("id");
    res.clearCookie("user");

    console.log("Logged out successfully");

    await req.user.save();

    req.session.message = {
      type: "Success",
      intro: "Logged Out Successfully ",
      message: "login or register!",
    };
    res.redirect("/Login");
    delete req.session.message;
  } catch (error) {
    res.status(500).redner("index.hbs");
    req.session.message = {
      type: "Backend problem",
      intro: "Something went wrong ",
      message: "please try again later",
    };
  }
});

// //Creating a new user in DB

app.post("/Admin/Timeline", async (req, res) => {
  try {
    const addTimeline = new Timeline({
      name: req.body.name,
      time: req.body.time,
      discription: req.body.discription,
    });
    const eventName = await Timeline.findOne({ name: addTimeline.name });
    const eventDate = await Timeline.findOne({ time: addTimeline.time });
    if (eventName) {
      req.session.message = {
        type: "Danger",
        intro: "Event already exsits ",
        message: "Please use another Name for the event",
      };
      res.redirect("/Admin");
      delete req.session.message;
    } else if (eventDate) {
      req.session.message = {
        type: "Danger",
        intro: "Event already exsits ",
        message: "Please use another Date for the event",
      };
      res.redirect("/Admin");
      delete req.session.message;
    } else {
      addTimeline
        .save()
        .then((user) => {
          res.status(201).redirect("/Tasks");
        })
        .catch((error) => console.log(error));
      req.session.message = {
        type: "Success",
        intro: "Registration successful ",
        message: "Please Login",
      };
    }
  } catch (error) {
    req.session.message = {
      type: "Danger",
      intro: "Backend Problem ",
      message: "Please try again later",
    };
    res.redirect("/Admin");
    delete req.session.message;
  }
});

app.post("/Admin/Tasks", async (req, res) => {
  try {
    const addTasks = new Tasks({
      username: req.body.member,
      task: req.body.tasks,
      deadline: req.body.deadline,
    });
    addTasks
      .save()
      .then((user) => {
        res.status(201).redirect("/Admin");
      })
      .catch((error) => console.log(error));

    req.session.message = {
      type: "Success",
      intro: "Done ",
      message: "Task Added Succesfully",
    };
  } catch (error) {
    req.session.message = {
      type: "Danger",
      intro: "Backend Problem ",
      message: "Please try again later",
    };
    res.redirect("/Admin");
    delete req.session.message;
  }
});

app.get("/Admin/Clear", async (req, res) => {
  const username = req.cookies.user
  const role = await Register.findOne({username: username}, { username: 1, memberoradmin: 1, _id: 0 });
  
  if (req.cookies.keyrem) {
    if (role.memberoradmin === "Admin") {
      await Tasks.deleteMany({});
      req.session.message = {
        type: 'Success',
        intro: 'Done',
        message: 'All previous tasks cleared'
      }
      res.redirect("/Admin");
      delete req.session.message
    } else {
      res.render("/");
    }
  } else {
      req.session.message = {
      type: 'Forbidden',
      intro: 'Access Denied',
      message: 'You need to have Admin role to access Admin platform'
    }
    res.redirect('/')
    delete req.session.message
  }
})

app.post("/Admin/Register", async (req, res) => {
  try {
    const registerUser = new Register({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      about: req.body.about,
      department: req.body.department,
      memberoradmin: req.body.memberoradmin,
    });

    const userEmail = await Register.findOne({ email: registerUser.email });
    const userName = await Register.findOne({
      username: registerUser.username,
    });

    if (
      registerUser.name == "" ||
      registerUser.email == "" ||
      registerUser.password == ""
    ) {
      req.session.message = {
        type: "Danger",
        intro: "Empty fields ",
        message: "Please fill all the required fields",
      };
      res.redirect("/Admin");
      delete req.session.message;
    } else if (userEmail) {
      req.session.message = {
        type: "Danger",
        intro: "Email already exsits ",
        message: "Please use another Email or Login using the exisiting Email",
      };
      res.redirect("/Admin");
      delete req.session.message;
    } else if (userName) {
      req.session.message = {
        type: "Danger",
        intro: "Username already exsits ",
        message:
          "Please use another Username or Login using the exisiting Username",
      };
      res.redirect("/Admin");
      delete req.session.message;
    } else if (registerUser.password.length < 6) {
      req.session.message = {
        type: "Danger",
        intro: "Password too short ",
        message: "Please enter a password of at least 6 characters",
      };
      res.redirect("/Admin");
      delete req.session.message;
    } else if (registerUser == "") {
      req.session.message = {
        type: "Danger",
        intro: "Connection Issues ",
        message:
          "Please connect to internet, or there is a problem in our backend",
      };
      res.redirect("/Admin");
      delete req.session.message;
    } else {
      bcrypt.genSalt(10, (err, salt) =>
        bcrypt.hash(registerUser.password, salt, async (err, hash) => {
          if (err) console.log(err);

          registerUser.password = hash;

          const token = await registerUser.generateAuthToken();
          console.log(token);

          registerUser
            .save()
            .then((user) => {
              res.status(201).redirect("/Login");
            })
            .catch((error) => console.log(error));
        })
      );
      req.session.message = {
        type: "Success",
        intro: "Registration successful ",
        message: "Please Login",
      };
    }
  } catch (err) {
    res.status(400).send(err);
    req.session.message = {
      type: "Backend Problem",
      intro: "Something went wrong ",
      message: "Cannot register user please try again later",
    };
    res.redirect("/");
    delete req.session.message;
  }
});

app.post('/Contact.html', (req, res) =>{
  console.log(req.body)
  try{
      const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
              type: "OAuth2",
              user: gmUser,
              clientId: cliId,
              clientSecret: cliSec,
              refreshToken: rfTk,
              accessToken: accTk
          }
      })

      const mailOptions = {
          from: req.body.email,
          to: gmUser,
          subject: `Message from ${req.body.email}: Query from A'ashab-ul-Hayyat audience!`,
          text: `${req.body.message} \n \nFrom ${req.body.name}`,
      }

      transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
              console.log(err);
              req.session.message = {
                  type: 'Backend Problem',
                  intro: 'Message sent successfully',
                  message: 'we will get to you as soon as possible'
              }
              res.redirect('/')
              delete req.session.message
          } else {
              console.log('Email sent: ' + info.response);
              req.session.message = {
                  type: 'Success',
                  intro: 'Message sent successfully  ',
                  message: 'we will get to you as soon as possible'
              }
              res.redirect('/')
              delete req.session.message
          }
      });

  } catch {
      
      req.session.message = {
          type: 'Backend Problem',
          intro: 'Something went wrong ',
          message: 'Cannot send the query due to backend problem.'
      }
      res.redirect('/Contact.html')
      delete req.session.message
  }

});

// //Server live realod for updating HTML and CSS files in browser, only for development session

const livereload = require("livereload");
const { response } = require("express");
const { ALL } = require("dns");
const { handlebars } = require("hbs");
const { collection } = require("./src/models/user");
const { devNull, userInfo } = require("os");
const lrserver = livereload.createServer({
  exts: ["js", "css", "hbs", "html", "svg"],
});
lrserver.watch(partials_path);
lrserver.watch(template_path);
lrserver.watch(static_path);

// //Server listening port

server.listen(PORT, () => {
  console.log(`Server is Up and Running at port:`, PORT);
});
