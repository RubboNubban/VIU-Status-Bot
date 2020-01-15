//includes
const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const http = require('http');

//site
const gateway = 'http://viu.apparmor.com/Tools/AlertHistory/';

var newestAlert;
var alerts = [];

//Update alerts[]
function getData() {
  http.get(gateway, (res) => {
    const { statusCode } = res;
    const contentType = res.headers['content-type'];

    let error;
    if (statusCode !== 200) {
      error = new Error('Request Failed.\n' + `Status Code: ${statusCode}`);
    } else if (!/^text\/html/.test(contentType)) {
      error = new Error('Invalid content-type.\n' + `Expected text/html but received ${contentType}`);
    }
    if (error) {
      console.error(error.message);
      // Consume response data to free up memory
      res.resume();
      return;
    }

    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
      try {
        const parsedData = JSON.parse(rawData);
        alerts = parsedData.AlertFeedItems;
        updateLatestAlert();
      } catch (e) {
        console.error(e.message);
      }
    });
  }).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
  });
};

//Converts an alert into a string that's ready to send in discord
function alertToString(a)
{
  return `**${a.DateTimeString}**\n\
**${a.Title}**\n\n\
${a.Description}`;
}

var autoChannels = []
function updateLatestAlert()
{
  if(alerts[0] != newestAlert)  {
    newestAlert = alerts[0];
    for(let i = 0 ; i < autoChannels; i++)
      autoChannels.send(alertToString(newestAlert));
  }
}
function autoAnnouncement()
{
  getData();
  updateLatestAlert();
}

var globalTimer;
client.on('ready', () => {
  console.log('Online and running');
  getData();
  globalTimer = setInterval(autoAnnouncement, 600000);
});

//code stolen from https://stackoverflow.com/questions/3954438/how-to-remove-item-from-array-by-value
Array.prototype.remove = function() {
  var what, a = arguments, L = a.length, ax;
  while (L && this.length) {
      what = a[--L];
      while ((ax = this.indexOf(what)) !== -1) {
          this.splice(ax, 1);
      }
  }
  return this;
};

let prefix = config.prefix;
client.on("message", (message) => {
  const args = message.content.slice(prefix.length).split(/ +/g);
  const command = args.shift().toLowerCase();
  const author = message.author.id;
  // Exit and stop if the prefix is not there or if user is a bot
  if (!message.content.startsWith(prefix) || message.author.bot) return;
    switch (command) {
      case 'alert':
        message.channel.send(alertToString(newestAlert)).then(sent => {

          const reacts = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
          var currentPage = 0;
          let max = alerts.length - 1;

          function addButtons() {
            for (let i = 0; i <= max; i++) {
              setTimeout(function() {
                sent.react(reacts[i]);
              }, i * 300);
            }
          }

          function createCollecterMessage(msg) {
              const filter = (reaction, user) => {
                return reacts.indexOf(reaction.emoji.name) !== -1 && user.id === author;
              };
              const collector = msg.createReactionCollector(filter, { time: 120000 });

              collector.on('collect', (reaction, reactionCollector) => {
                msg.edit(alertToString(alerts[reacts.indexOf(reaction.emoji.name)]));
                reaction.remove(author);
              });
          }

          addButtons();
          createCollecterMessage(sent);

        });
      break;
      case 'subscribe':
        if(!message.member.hasPermission("ADMINISTRATOR")) {
          message.channel.send("You don't have permissions to subscribe to a channel!");
          return;
        }
        try {
          var channel = client.channels.find('name', args[0]);
          if (!channel) {
            return message.channel.send("Could not find channel: " + args[0]);
          } else if (autoChannels.indexOf(channel.id) !== -1) {
            return message.channel.send("Already subscribed to channel: " + args[0]);
          }
          autoChannels.push(channel.id);
          message.channel.send("Subscribed to " + args[0]);
        }
        catch (e) {
          console.error(e);
        }
      break;
      case 'unsubscribe':
          if(!message.member.hasPermission("ADMINISTRATOR")) {
            message.channel.send("You don't have permissions to unsubscribe from a channel!");
            return;
          }
          try {
            var channel = client.channels.find('name', args[0]);
            if (!channel) {
              return message.channel.send("Could not find channel: " + args[0]);
            } else if (autoChannels.indexOf(channel.id) === -1) {
              return message.channel.send("Not subscribed to channel: " + args[0]);
            }
            autoChannels.remove(channel.id);
            message.channel.send("Unsubscribed from " + args[0]);
          }
          catch (e) {
            console.error(e);
          }
      break;
    }
});

client.login(config.token);
