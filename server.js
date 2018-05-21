require('dotenv').config();

const slackEventsApi = require('@slack/events-api');
const SlackClient = require('@slack/client').WebClient;
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const slackEvents = slackEventsApi.createSlackEventAdapter(
  process.env.SLACK_VERIFICATION_TOKEN
);

const slack = new SlackClient(process.env.SLACK_BOT_TOKEN);

function extractImageURL(message) {
  if (message.subtype === 'file_share') {
    const { file } = message;
    if (file.mimetype.indexOf('image/') === 0) {
      return file.url_private;
    }
  } else if (message.subtype === 'message_changed') {
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
    this.path = path.join('.data', filename);
    this.asString = new String(fs.readFileSync(this.path));
    this.data = JSON.parse(this.asString);
    this.cbs = new Set();
  }

  get() {
    return this.asString;
  }

  set(data) {
    this.data = data;
    this.asString = JSON.stringify(data);
    fs.writeFileSync(this.path, this.asString);
    for (const cb of this.cbs) {
      cb(this.asString);
    }
  }

  subscribe(cb) {
    this.cbs.add(cb);
    return cb;
  }

  unsubscribe(cb) {
    this.cbs.delete(cb);
  }
}

const image = new Cell('image.json');

const app = express();

app.use('/slack/events', bodyParser.json());
app.use('/slack/events', slackEvents.expressMiddleware());

app.get('/stream', function(req, res) {
  res.type('text/event-stream');

  res.write(`data: ${image.get()}\n\n`);

  const sub = image.subscribe(function(data) {
    res.write(`data: ${data}\n\n`);
  });

  req.on('close', function() {
    image.unsubscribe(sub);
  });
});

if (app.get('env') === 'development') {
  app.get('/image/set', function(req, res) {
    image.set(req.query);
    res.sendStatus(200);
  });
}

app.use('/', express.static('dist'));

slackEvents.on('message', message => {
  const src = extractImageURL(message);
  if (src) {
    image.set({ src });
  }
});

slackEvents.on('error', error => {
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
