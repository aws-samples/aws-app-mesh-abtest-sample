//
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this
// software and associated documentation files (the "Software"), to deal in the Software
// without restriction, including without limitation the rights to use, copy, modify,
// merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

const createError = require("http-errors");
const express = require("express");
const cookieParser = require('cookie-parser');
const path = require("path");
const logger = require("morgan");
const hbs = require("hbs");
const env = require("env-var");

const session = require("express-session");
const RedisStore = require("connect-redis")(session);

const { createClient } = require("redis");
const redisClient = createClient({ url: env.get("REDIS_ENDPOINT", "redis://localhost:6379/0").asString(), legacyMode: true });
redisClient.connect().catch(console.error);

const infoRouter = require("./routes/info");
const healthRouter = require("./routes/health");
const metricsRouter = require("./routes/metrics");
const indexRouter = require("./routes/index");
const cartRouter = require("./routes/cart");
const productRouter = require("./routes/product");
const imagesRouter = require("./routes/images");

const app = express();

app.use(logger("common"));

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");
hbs.registerPartials(__dirname + "/views/partials");
hbs.registerHelper("imageservice", function () {
  return '/images';
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(cookieParser());

app.use("/info", infoRouter);
app.use("/healthz", healthRouter); // Load health route early, does not need session init etc...
app.use("/api/v1/metrics", metricsRouter);

const sessionMiddleware = session({
  store: new RedisStore({ url: env.get("REDIS_ENDPOINT", "redis://localhost:6379/0").asString(), client: redisClient }),
  secret: env.get("SECRET_KEY", "my not so random secret").asString(),
  resave: false,
  saveUninitialized: true,
  name: "microservices_store_sid"
});

// Session reconnect handling
app.use(function (req, res, next) {
  var tries = 3;

  function lookupSession(error) {
    if (error) return next(error);

    tries -= 1;

    if (req.session !== undefined) return next();

    if (tries < 0) return next(new Error("Can not start session. Is the session store available?"));

    sessionMiddleware(req, res, lookupSession);
  }

  lookupSession();
});

app.use(express.static(path.join(__dirname, "public")));

// Custom flash middleware -- from Ethan Brown's book, 'Web Development with Node & Express'
app.use(function (req, res, next) {
  // if there's a flash message in the session request, make it available in the response, then delete it
  if (req.session !== undefined) {
    res.locals.sessionFlash = req.session.sessionFlash;
    delete req.session.sessionFlash;
  }
  next();
});

app.use(function (req, res, next) {
  if (!req.cookies['app_version']) {
    res.cookie('app_version', env.get("VERSION", "v1").asString(), { httpOnly: true });
  }
  next();
});

// Routes need to be loaded last
app.use("/", indexRouter);
app.use("/cart", cartRouter);
app.use("/product", productRouter);
app.use("/images", imagesRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }

  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
