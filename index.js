var tmi = require('tmi.js');
var api = require('twitch-api-v5');
var dirty = require('dirty');
var dbCommands = dirty('commands.db');
var settings = require('./config.js')
var request = require('request')
var StreamlabsSocketClient = require('streamlabs-socket-client');

settings.ACCESS = settings['OWNER_OAUTH'].split(":")[1]

function uptime(startTime) {
  var created_at = new Date(startTime);
  var now = new Date().getTime();
  var diff = now - created_at;
  var seconds = parseInt((diff / 1000) % 60);
  var minutes = parseInt((diff / (60000)) % 60);
  var hours   = parseInt((diff / (3600000)) % 24);

  return hours + " hours " + minutes + " minutes and " + seconds + " seconds."
}

var SLclient = new StreamlabsSocketClient({
  token: settings.STREAMLABS_SOCKET_TOKEN,
  emitTests: true // true if you want alerts triggered by the test buttons on the streamlabs dashboard to be emitted. default false.
});

var TIMER_COOLDOWN = Date.now()
var TIMER_COOLDOWN_LENGTH = 1000 * 60 * 10;

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
var inbuilt_commands = Object.create(null)

inbuilt_commands = {
  "!addcom": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      if (commands[0][0] !== "!") {
        bot.say(settings.CHANNEL, "The command name must start with a ! SHIREE");
        return;
      }
      var output = commands.splice(1).join(" ")
      if (output[0] === '!') {
        bot.say(settings.CHANNEL, "The command output cannot start with a ! MahoHuh")
      } else {
        dbCommands.set(commands[0], output)
        bot.say(settings.CHANNEL, "The command " + commands[0] + " has been added. FeelGood")
      }
    }
  },

  "!editcom": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      dbCommands.update(commands[0], function (currentComand) {
          return commands.splice(1).join(" ")
      })

      bot.say(settings.CHANNEL, "The command " + commands[0] + " has been edited. HungryTag")
    }
  },

  "!delcom": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      dbCommands.rm(commands[0])

      bot.say(settings.CHANNEL, "The command " + commands[0] + " has been deleted. HungryTag")
    }
  },

  "!game": function (commands, userstate) {
    if (commands[0]) {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        api.channels.updateChannel({ channelID: settings.CHANNELID, auth: settings.ACCESS, game: commands.join(" ")}, function (err, res) {
           if (err) {
            console.warn(err)
            return;
           } else {
             bot.say(settings.CHANNEL, "Game has been updated to: " + commands.join(" ") + " KurisuFact")
           }
        })
      }
    } else {
      api.channels.channel({ auth: settings.ACCESS}, function (err, res) {
        if (err) {
          console.warn(err)
        } else {
          bot.say(settings.CHANNEL, "Game is currently set to: " + res.game + " KurisuFact")
        }
      })
    }
  },

  "!title": function(commands, userstate) {
    if (commands[0]) {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        api.channels.updateChannel({ channelID: settings.CHANNELID, auth: settings.ACCESS, status: commands.join(" ")}, function (err, res){
          if (err) {
            console.warn(err)
            return;
          } else {
            bot.say(settings.CHANNEL, "Title has been updated to: " + commands.join(" ") + " KurisuFact")
          }
        })
      }
    } else {
      api.channels.channel({ auth: settings.ACCESS}, function (err, res) {
        if (err) {
          console.warn(err)
          return;
        } else {
          bot.say(settings.CHANNEL, "Title is currently set to: " + res.status + " KurisuFact")
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
          bot.say(settings.CHANNEL, "The stream has been live for: " + uptime(res.stream.created_at) + " Naruhodo")
        } else {
          bot.say(settings.CHANNEL, "The stream is not live. cmonBruh")
        }
      }
    })
  },

  "!shoutout": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      var streamer = commands[0][0] === '@' ? commands[0].substr(1).toLowerCase() : commands[0].toLowerCase()
      bot.say(settings.CHANNEL, "Go give " + commands[0] + " a follow at twitch.tv/" + streamer + " Pog")
    }
  },

  "!maltesers": function (commands, userstate) {
    if (commands[0] === 'everyone') {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        if (isNaN(commands[1])) return
        request({
          method: 'POST',
          url: 'https://streamlabs.com/api/v1.0/points/add_to_all',
          form: {
            access_token: settings.STREAMLABS_ACCESS_TOKEN,
            channel: settings.CHANNEL,
            value: commands[1]
          }
        }, function (error, response, body) {
          var res = JSON.parse(body)
          if (res.message === 'Success') {
            bot.say(settings.CHANNEL, commands[1] + " maltesers for everyone! Daijoubu")
          } else {
            bot.say(settings.CHANNEL, "Something went wrong: " + res.error)
          }
        })
      }
//    } else if () {


    } else {
      request({ method: 'GET',
        url: 'https://streamlabs.com/api/v1.0/points',
        qs: {
          access_token: settings.STREAMLABS_ACCESS_TOKEN,
          username: commands[0] || userstate.username,
          channel: settings.CHANNEL } },
        function (err, res, body) {
          if (err) bot.say(settings.CHANNEL, err.toString())
          body = JSON.parse(body)
          if (body.error) {
            bot.say(settings.CHANNEL, body.message)
          } else {
            bot.say(settings.CHANNEL, body.username + " has " + body.points + " maltesers! KannaNom")
          }
      })
    }
  },

  "!emptyjar": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      request({
        method: 'POST',
        url: 'https://streamlabs.com/api/v1.0/jar/empty',
        form: {
          access_token: settings.STREAMLABS_ACCESS_TOKEN
        }
      }, function (error, response, body) {
        var res = JSON.parse(body)
        if (res.error) {
          bot.say(settings.CHANNEL, "There was an error: "+ res.error)
        }

        if (res.success) {
          bot.say(settings.CHANNEL, "The cup has been emptied! KannaWOT")
        }
      })
    }
  },

  "!vanish": function (commands, userstate) {
    if (userstate.mod) {
      owner.timeout(settings.CHANNEL, userstate.username, 1);
      setTimeout(function () {
        owner.mod(settings.CHANNEL, userstate.username)
      }, 100)
    } else {
      bot.timeout(settings.CHANNEL, userstate.username, 1);
    }
  },

  "!commands": function(commands) {
    var data = Object.keys(inbuilt_commands)
    dbCommands.forEach(function (key) {
      data.push(key)
    })
    bot.say(settings.CHANNEL, data.join(" "))
  }
}

SLclient.on('follow', function (data) {
  bot.action(settings.CHANNEL, " Thank you " + data.name + " for following. kannaSippyn <3")
});

owner.on("hosted", function (channel, username, viewers, autohost) {
  if (!autohost) bot.action(settings.CHANNEL, "Thank you "  + username + " for the host! TaruTaru");
});

owner.on("raid", function (channel, raider, viewers, userstate) {
  bot.action(settings.CHANNEL, "Pog INCOMING " + raider.toUpperCase() + " RAID Pog")
});

bot.on("cheer", function (channel, userstate, message) {
  bot.action(settings.CHANNEL, "Thank you " + userstate.username + " for the " + userstate.bits + " bits!!! IAStare" );
});

bot.on("subscription", function (channel, username) {
    bot.action(settings.CHANNEL, "Thank you "  + username + " for subscribing! TooGood <3 <3");
});

bot.on("resub", function (channel, username, months, message, userstate, methods) {
    bot.action(settings.CHANNEL, "Thank you "  + username + " for the " + months + " month resub! RoWOW <3 <3");
});

bot.on("subgift", function (channel, username, recipient, plan, userstate) {
  bot.action(settings.CHANNEL, "Thank you "  + username + " for gifting a sub to " + recipient + "! PoiHug <3 <3");
})

bot.on("chat", function (channel, userstate, message, self) {
  if (self) return;

  if (Date.now() - TIMER_COOLDOWN > TIMER_COOLDOWN_LENGTH) {
    bot.action(settings.CHANNEL, "Did you know that every minute watched equals 5 maltesers? You can gamble them in the Streamlabs overlay AND redeem stuff there. OhIToot")
    TIMER_COOLDOWN = Date.now()
  }

  if (message[0] === "!") {
    var commands = message.split(" ")

    if (inbuilt_commands[commands[0]]) {
      inbuilt_commands[commands[0]](commands.splice(1), userstate)
    }

    if (dbCommands.get(commands[0])) {
      bot.say(settings.CHANNEL, dbCommands.get(commands[0]))
    }
  }
});
