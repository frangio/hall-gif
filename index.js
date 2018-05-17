// Load environment variables from `.env` file (optional)
require("dotenv").config();

const slackEventsApi = require("@slack/events-api");
const SlackClient = require("@slack/client").WebClient;
const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");

const slackEvents = slackEventsApi.createSlackEventAdapter(
  process.env.SLACK_VERIFICATION_TOKEN
);

const slack = new SlackClient(process.env.SLACK_BOT_TOKEN);

function extractImage(message) {
  console.log(message);
  if (message.subtype === "file_share") {
    const { file } = message;
    if (file.mimetype.indexOf("image/") === 0) {
      return file.url_private;
    } else {
      throw "only images for now plz";
    }
  } else if (message.subtype === "message_changed") {
    console.log(message.message.attachment);
  } else if (message.attachment) {
    console.log(message.attachment);
  }
}

class Cell {
  constructor(path) {
    this.path = path;
    this.data = JSON.parse(fs.readFileSync(this.path));
    this.cbs = new Set();
  }

  get() {
    return this.data;
  }

  set(data) {
    fs.writeFileSync(this.path, JSON.stringify(data));
    this.data = data;

    setTimeout(() => this.publish(data));
  }

  publish(data) {
    for (const cb of this.cbs) {
      cb(data);
    }
    this.cbs.clear();
  }

  subscribe(cb) {
    this.cbs.add(cb);
    return cb;
  }

  unsubscribe(cb) {
    this.cbs.delete(cb);
  }
}

const image = new Cell("image.json");

const app = express();

app.use("/slack/events", bodyParser.json());
app.use("/slack/events", slackEvents.expressMiddleware());

app.get("/image/poll", function(req, res) {
  req.on("close", function() {
    image.unsubscribe(sub);
  });

  const sub = image.subscribe(function(data) {
    res.sendStatus(205);
  });
});

// // useful for testing locally
// app.get("/image/set", function(req, res) {
//   image.set(req.query);
//   res.sendStatus(200);
// });

app.get("/image/redirect", function(req, res) {
  res.redirect(303, image.get().src);
});

app.use("/", express.static("public"));

slackEvents.on("message", message => {
  try {
    const img = extractImage(message);
    setImage(img);
  } catch (e) {
    slack.chat.postMessage(message.channel, e).catch(console.error);
  }
});

slackEvents.on("error", error => {
  if (error.code === slackEventsApi.errorCodes.TOKEN_VERIFICATION_FAILURE) {
    // This error type also has a `body` propery containing the request body which failed verification.
    console.error(`An unverified request was sent to the Slack events Request URL. Request body: \
${JSON.stringify(error.body)}`);
  } else {
    console.error(
      `An error occurred while handling a Slack event: ${error.message}`
    );
  }
});

const port = process.env.PORT || 3000;
http.createServer(app).listen(port, () => {
  console.log(`server listening on port ${port}`);
});
