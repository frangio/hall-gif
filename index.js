// Load environment variables from `.env` file (optional)
require('dotenv').config();

const slackEventsApi = require('@slack/events-api');
const SlackClient = require('@slack/client').WebClient;
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

// *** Initialize event adapter using verification token from environment variables ***
const slackEvents = slackEventsApi.createSlackEventAdapter(process.env.SLACK_VERIFICATION_TOKEN);

const slack = new SlackClient(process.env.SLACK_BOT_TOKEN);

const IMAGE_URL_FILE = '.data/image-url';

function setImage(url) {
  fs.writeFileSync(IMAGE_URL_FILE, url);
  console.log(`Setting new image ${url}`);
}

function extractImage(message) {
  console.log(message);
  if (message.subtype === 'file_share') {
    const { file } = message;
    if (file.mimetype.indexOf('image/') === 0) {
      return file.url_private;
    } else {
      throw "only images for now plz";
    }
  } else if (message.subtype === 'message_changed') {
    console.log(message.message.attachment);
  } else if (message.attachment) {
    console.log(message.attachment);
  } 
}
    



// Initialize an Express application
const app = express();

app.use(bodyParser.json());

app.get('/', (req, res) => {
  const img = fs.readFileSync(IMAGE_URL_FILE);
  res.send(`<img src="${img}">`);
})

// *** Plug the event adapter into the express app as middleware ***
app.use('/slack/events', slackEvents.expressMiddleware());

// *** Greeting any user that says "hi" ***
slackEvents.on('message', (message) => {
  try {
    const img = extractImage(message);
    setImage(img);
  } catch (e) {
    slack.chat.postMessage(message.channel, e).catch(console.error);
  }
});

// *** Handle errors ***
slackEvents.on('error', (error) => {
  if (error.code === slackEventsApi.errorCodes.TOKEN_VERIFICATION_FAILURE) {
    // This error type also has a `body` propery containing the request body which failed verification.
    console.error(`An unverified request was sent to the Slack events Request URL. Request body: \
${JSON.stringify(error.body)}`);
  } else {
    console.error(`An error occurred while handling a Slack event: ${error.message}`);
  }
});

// Start the express application
const port = process.env.PORT || 3000;
http.createServer(app).listen(port, () => {
  console.log(`server listening on port ${port}`);
});
