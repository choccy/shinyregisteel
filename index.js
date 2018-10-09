var tmi = require('tmi.js');
var StreamlabsSocketClient = require('streamlabs-socket-client');
var api = require('twitch-api-v5');
var dirty = require('dirty');
var dbCommands = dirty('commands.db');
var settings = require('./config.js')
var request = require("request");

settings.ACCESS = settings['OWNER_OAUTH'].split(":")[1]

var SLclient = new StreamlabsSocketClient({
  token: settings.STREAMLABS_SOCKET_TOKEN,
  emitTests: true // true if you want alerts triggered by the test buttons on the streamlabs dashboard to be emitted. default false.
});

function uptime(startTime) {
  var created_at = new Date(startTime);
  var now = new Date().getTime();
  var diff = now - created_at;
  var seconds = parseInt((diff / 1000) % 60);
  var minutes = parseInt((diff / (60000)) % 60);
  var hours   = parseInt((diff / (3600000)) % 24);

  return hours + " hours " + minutes + " minutes and " + seconds + " seconds."
}

var bot = new tmi.client({
    options: {
        debug: false
    },
    connection: {
        reconnect: true
    },
    identity: {
        username: settings.BOT_NAME,
        password: settings.BOT_OAUTH
    },
    channels: [settings.CHANNEL]
});

var owner = new tmi.client({
    options: {
        debug: false
    },
    connection: {
        reconnect: true
    },
    identity: {
        username: settings.CHANNEL,
        password: settings.OWNER_OAUTH
    },
    channels: [settings.CHANNEL]
});

bot.connect();
owner.connect();
SLclient.connect();

api.clientID = settings.CLIENTID;

var inbuilt_commands = {
  "!addcom": function (commands, userstate) {
    if (userstate.mod || userstate.badges.broadcaster === '1') {
      if (commands[0][0] !== "!") {
        bot.action(settings.CHANNEL, "The command name must start with a !");
        return;
      }
      var output = commands.splice(1).join(" ")
      if (output[0] === '!') {
        bot.action(settings.CHANNEL, "The command output cannot start with a !")
      } else {
        dbCommands.set(commands[0], output)
        bot.action(settings.CHANNEL, "The command " + commands[0] + " has been added.")
      }
    }
  },

  "!delcom": function (commands, userstate) {
    if (userstate.mod || userstate.badges.broadcaster === '1') {
      dbCommands.rm(commands[0])

      bot.action(settings.CHANNEL, "The command " + commands[0] + " has been deleted.")
    }
  },

  "!game": function (commands, userstate) {
    if (commands[0]) {
      if (userstate.mod || userstate.badges.broadcaster === '1') {
        api.channels.updateChannel({ channelID: settings.CHANNELID, auth: settings.ACCESS, game: commands.join(" ")}, function (err, res) {
           if (err) {
            console.warn(err)
            return;
           } else {
             bot.action(settings.CHANNEL, "Game has been updated to: " + commands.join(" "))
           }
        })
      }
    } else {
      api.channels.channel({ auth: settings.ACCESS}, function (err, res) {
        if (err) {
          console.warn(err)
        } else {
          bot.action(settings.CHANNEL, "Game is currently set to: " + res.game)
        }
      })
    }
  },

  "!title": function(commands, userstate) {
    if (commands[0]) {
      if (userstate.mod || userstate.badges.broadcaster === '1') {
        api.channels.updateChannel({ channelID: settings.CHANNELID, auth: settings.ACCESS, status: commands.join(" ")}, function (err, res){
          if (err) {
            console.warn(err)
            return;
          } else {
            bot.action(settings.CHANNEL, "Title has been updated to: " + commands.join(" "))
          }
        })
      }
    } else {
      api.channels.channel({ auth: settings.ACCESS}, function (err, res) {
        if (err) {
          console.warn(err)
          return;
        } else {
          bot.action(settings.CHANNEL, "Title is currently set to: " + res.status)
        }
      })
    }
  },

  "!uptime": function (commands) {
    api.streams.channel({ channelID: settings.CHANNELID }, function (err, res) {
      if (err) {
        console.warn(err)
        return;
      } else {
        if (res.stream) {
          bot.action(settings.CHANNEL, "The stream has been live for: " + uptime(res.stream.created_at))
        } else {
          bot.action(settings.CHANNEL, "The stream is not live.")
        }
      }
    })
  },

  "!maltesers": function (commands, userstate) {
    request({ method: 'GET',
      url: 'https://streamlabs.com/api/v1.0/points',
      qs: {
        access_token: settings.STREAMLABS_ACCESS_TOKEN,
        username: commands[0] || userstate.username,
        channel: settings.CHANNEL } },
      function (err, res, body) {
        body = JSON.parse(body)
        if (err) throw new Error(err);
        bot.action(settings.CHANNEL, body.username + " has " + body.points + " maltesers!")
     })
  },

  "!commands": function(commands) {
    var data = Object.keys(inbuilt_commands)
    dbCommands.forEach(function (key) {
      data.push(key)
    })
    bot.action(settings.CHANNEL, data.join(" "))
  }
}

SLclient.on('follow', function (data) {
  bot.action(settings.CHANNEL, " Thank you " + data.name + " for following! <3")
});

owner.on("hosted", function (channel, username, viewers, autohost) {
  bot.action(settings.CHANNEL, "Thank you "  + username + " for the host!");
});

bot.on("cheer", function (channel, userstate, message) {
  bot.action(settings.CHANNEL, "Thank you " + userstate.username + " for the " + userstate.bits + "bits!!! PogChamp" );
});

bot.on("subscription", function (channel, username) {
    bot.action(settings.CHANNEL, "Thank you "  + username + " for subscribing! <3 <3");
});

bot.on("resub", function (channel, username, months, message, userstate, methods) {
    bot.action(settings.CHANNEL, "Thank you "  + username + " for the " + months + " month resub! <3 <3");
});

bot.on("chat", function (channel, userstate, message, self) {
  if (self) return;

  if (message[0] === "!") {
    var commands = message.split(" ")

    if (inbuilt_commands[commands[0]]) {
      inbuilt_commands[commands[0]](commands.splice(1), userstate)
    }

    if (dbCommands.get(commands[0])) {
      bot.action(settings.CHANNEL, dbCommands.get(commands[0]))
    }
  }
});
