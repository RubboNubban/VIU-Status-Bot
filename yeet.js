const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const http = require('http');

let prefix = config.prefix;
client.on("message", (message) => {
  const args = message.content.slice(prefix.length).split(/ +/g);
  const command = args.shift().toLowerCase();
  const options = {
    hostname: 'http://viu.apparmor.com/Tools/AlertHistory/',
    port: 443,
    path: '/',
    method: 'GET'
  };
  // Exit and stop if the prefix is not there or if user is a bot
  if (!message.content.startsWith(prefix) || message.author.bot) return;
    switch (command) {
      case "alert":
      http.get('http://viu.apparmor.com/Tools/AlertHistory/', (res) => {
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
            //console.log(parsedData);
            message.channel/*client.channels.get('467017233307009045')*/.send(`Date/Time:\n\`${parsedData.AlertFeedItems[0].DateTimeString}\`\n\
    Title:\n\`${parsedData.AlertFeedItems[0].Title}\`\n\
    Description:\n\`\`\`${parsedData.AlertFeedItems[0].Description}\`\`\``);
          } catch (e) {
            console.error(e.message);
          }
        });
        }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
        });
        break;
    }
});

client.login(config.token);
