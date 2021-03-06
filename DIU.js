//includes
const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const http = require('http');
const fs = require('fs');

const prefix = config.prefix;
const helpEmbed = new Discord.RichEmbed()
.setColor(0x338cb5)
.addField(`${prefix}help`, "Sends this message", true)
.addField(`${prefix}alert`, "Displays current alerts from the VIU Safety App", true)
.addBlankField()
.addField(`${prefix}subscribe <channel-name>`, "Subscribes a channel to get auto-updates when new alerts are posted", true)
.addField(`${prefix}unsubscribe <channel-name>`, "Unsubscribes a channel from getting auto-updates when new alerts are posted", true);

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

//save last alert to to a file
function saveLastMessage(a)
{
  var aString = JSON.stringify(a);
  fs.writeFileSync(__dirname + '/lastMessage.json', aString, 'utf8', function (err) {
    if (err) console.log(err);
  });
};

//compare last saved alert with alert to be sent
//return true if savedAlert is different from alert to be sent
function compareLastMessage(a)
{
  //code stolen from https://stackoverflow.com/questions/36856232/write-add-data-in-json-file-using-node-js
  const savedAlert = JSON.parse(fs.readFileSync(__dirname + '/lastMessage.json', 'utf-8'));
  if (a === undefined || savedAlert === undefined || (savedAlert.Description == a.Description && savedAlert.DateTimeString == a.DateTimeString)) {
    return false;
  }
  return true;
}

//Converts an alert into an embed that's ready to send in discord
function alertToEmbed(a)
{
  var description = a.Description;
  var footer = '';
  if (description.length > 2048) {
    footer = description.slice(2048);
    description = description.slice(0, 2048);
  }
  const embed = new Discord.RichEmbed()
      .setTitle(a.Title)
      .setAuthor(a.DateTimeString)
      .setColor(a.BackgroundColor)
      .setDescription(description)
      .setFooter(footer);
  return embed;
}

var autoChannels = [];

function getChannels() {
  fs.readFile(__dirname + '/channels.txt', 'utf8', (err, data) => {
    if (err)
      return console.log(err);

    autoChannels = data.trim().slice(0, -1).split(', ');
  });
}

getChannels();
function updateLatestAlert()
{
  newestAlert = alerts[0];
  if(compareLastMessage(newestAlert))  {
    autoChannels.forEach(channel => {
      client.channels.get(channel).send(alertToEmbed(newestAlert));
    });
    saveLastMessage(newestAlert);
  }
}

var globalTimer;
client.on('ready', () => {
  console.log('Online and running');
  getData();
  globalTimer = setInterval(getData, 60000);
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


client.on("message", (message) => {
  const args = message.content.slice(prefix.length).split(/ +/g);
  const command = args.shift().toLowerCase();
  const author = message.author.id;
  // Exit and stop if the prefix is not there or if user is a bot
  if (!message.content.startsWith(prefix) || message.author.bot) return;
    switch (command) {
      case 'help':
        message.channel.send(helpEmbed);
        break;

      case 'alert':
        message.channel.send(alertToEmbed(newestAlert)).then(sent => {
          if (alerts.length == 0)
            return message.channel.send("No alerts to display");
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
                msg.edit(alertToEmbed(alerts[reacts.indexOf(reaction.emoji.name)]));
                reaction.remove(author);
              });
          }

          if (max > 0) {
            addButtons();
          }
          createCollecterMessage(sent);

        });
      break;

      case 'subscribe':
        if(!message.member.hasPermission("MANAGE_CHANNELS")) {
          message.channel.send("You must have Manage Channels permissions to subscribe to a channel!");
          return;
        }
        try {
          if (args.join(" ") === '') {
            return message.channel.send("Enter a channel name to subscribe");
          }
          var channel = client.channels.find('name', args[0]);
          if (!channel) {
            return message.channel.send(`Could not find channel: #${args[0]}`);
          } else if (autoChannels.indexOf(channel.id) !== -1) {
            return message.channel.send(`Already subscribed to channel: #${args[0]}`);
          }
          autoChannels.push(channel.id);

          var file = fs.createWriteStream(__dirname + '/channels.txt');
          file.on('error', function(err) { console.log(err); });
          autoChannels.forEach(value => file.write(value + ', '));
          file.end();

          message.channel.send(`Subscribed to ${channel.toString()}`);
        }
        catch (e) {
          console.error(e);
        }
      break;

      case 'unsubscribe':
          if(!message.member.hasPermission("MANAGE_CHANNELS")) {
            message.channel.send("You must have Manage Channels permissions to unsubscribe from a channel!");
            return;
          }
          try {
            if (args.join(" ") === '') {
              return message.channel.send("Enter a channel name to unsubscribe");
            }
            var channel = client.channels.find('name', args[0]);
            if (!channel) {
              return message.channel.send(`Could not find channel: #${args[0]}`);
            } else if (autoChannels.indexOf(channel.id) === -1) {
              return message.channel.send(`Not subscribed to channel: #${args[0]}`);
            }
            autoChannels.remove(channel.id);

            var file = fs.createWriteStream(__dirname + '/channels.txt');
            file.on('error', function(err) { console.log(err); });
            autoChannels.forEach(value => file.write(value + ', '));
            file.end();

            message.channel.send(`Unsubscribed from ${channel.toString()}`);
          }
          catch (e) {
            console.error(e);
          }
      break;
    }
});

client.login(config.token);
