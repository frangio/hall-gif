require("dotenv").config();

const slackEventsApi = require("@slack/events-api");
const SlackClient = require("@slack/client").WebClient;
const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const slackEvents = slackEventsApi.createSlackEventAdapter(
  process.env.SLACK_VERIFICATION_TOKEN
);

const slack = new SlackClient(process.env.SLACK_BOT_TOKEN);

function extractImageURL(message) {
  if (message.subtype === "file_share") {
    const { file } = message;
    if (file.mimetype.indexOf("image/") === 0) {
      return file.url_private;
    }
  } else if (message.subtype === "message_changed") {
    return extractImageURL(message.message);
  } else if (message.attachments) {
    if (message.attachments.length > 0) {
      const url = message.attachments[0].image_url;
      if (url) {
        return url;
      }
    }
  }
}

class Cell {
  constructor(filename) {
    this.path = path.join(".data", filename);
    this.data = JSON.parse(fs.readFileSync(this.path));
    this.cbs = new Set();
  }

  get() {
    return this.data;
  }

  set(data) {
    fs.writeFileSync(this.path, JSON.stringify(data));
    this.data = data;
    setTimeout(() => this._publish(data));
  }

  subscribe(cb) {
    this.cbs.add(cb);
    return cb;
  }

  unsubscribe(cb) {
    this.cbs.delete(cb);
  }

  _publish(data) {
    for (const cb of this.cbs) {
      cb(data);
    }
    this.cbs.clear();
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

app.use("/", express.static("static"));

slackEvents.on("message", message => {
  const src = extractImageURL(message);
  if (src) {
    image.set({ src });
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
