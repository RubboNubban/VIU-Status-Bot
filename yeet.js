const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const http = require('http');
const Enmap = require("enmap");
const enmap = new Enmap({ name: "VIU_Status" });

function getData() {
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
        const dataMsg = `**${parsedData.AlertFeedItems[0].DateTimeString}**\n\
**${parsedData.AlertFeedItems[0].Title}**\n\n\
${parsedData.AlertFeedItems[0].Description}`;
        //console.log(parsedData);
        if (!enmap.has('statuses')) {
          enmap.set('statuses', [dataMsg]);
        } else {
          if (enmap.get('statuses').indexOf(dataMsg) == -1) {
            enmap.push('statuses', dataMsg);
            client.channels.get('467017233307009045').send(dataMsg);
          } else {
            return;
          }
          if (enmap.get('statuses').length > 3) {
            let array = enmap.get('statuses');
            enmap.remove('statuses', array[0]);
          }
        }
      } catch (e) {
        console.error(e.message);
      }
    });
  }).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
  });
};

client.on('ready', () => {
  console.log('Online and running');
  getData();
  setInterval(getData, 600000);
});

let prefix = config.prefix;
client.on("message", (message) => {
  const args = message.content.slice(prefix.length).split(/ +/g);
  const command = args.shift().toLowerCase();
  const author = message.author.id;
  // Exit and stop if the prefix is not there or if user is a bot
  if (!message.content.startsWith(prefix) || message.author.bot) return;
    switch (command) {
      case 'alert':
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
              const dataMsg = `**${parsedData.AlertFeedItems[0].DateTimeString}**\n\
**${parsedData.AlertFeedItems[0].Title}**\n\n\
${parsedData.AlertFeedItems[0].Description}`;
              //console.log(parsedData);
              if (enmap.get('statuses').indexOf(dataMsg) == -1) {
                enmap.push('statuses', dataMsg);
              }
              for (let i = 3; i < enmap.get('statuses').length; i++) {
                let array = enmap.get('statuses');
                enmap.remove('statuses', array[0]);
              }
              console.log(enmap.get('statuses'));
              message.channel.send(dataMsg).then(sent => {
                const statusArray = enmap.get('statuses');
                var currentPage = statusArray.length - 1;
                console.log(`Statuses: ${statusArray.length}\n${statusArray}`);
                function createCollecterMessage(msg) {
                  const filter = (reaction, user) => {
                    return reaction.emoji.name === '⬅' || reaction.emoji.name === '➡' && user.id === author;
                  };
                  const collector = msg.createReactionCollector(filter, { time: 120000 });

                  collector.on('collect', (reaction, reactionCollector) => {
                    if (reaction.emoji.name === '⬅' && currentPage !== 0) {
                      msg.edit(statusArray[currentPage--]);
                    } else if (reaction.emoji.name === '➡' && currentPage !== (statusArray.length - 1)) {
                      msg.edit(statusArray[currentPage++]);
                    }
                    console.log('Page: ', currentPage);
                    reaction.remove(author);
                  });
                }

                sent.react('⬅')
                .then(sentReaction => sentReaction.message.react('➡'))
                .then(sentReaction => createCollecterMessage(sentReaction.message));
              });
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
