var tmi = require('tmi.js');
var api = require('twitch-api-v5');
var dirty = require('dirty');
var dbCommands = dirty('commands.db');
var settings = require('./config.js');
var request = require('request');
var WebSocket = require('ws');
var StreamlabsSocketClient = require('streamlabs-socket-client');

function uptime(startTime) {
  var created_at = new Date(startTime);
  var now = new Date().getTime();
  var diff = now - created_at;
  var seconds = parseInt((diff / 1000) % 60);
  var minutes = parseInt((diff / (60000)) % 60);
  var hours   = parseInt((diff / (3600000)) % 24);

  return hours + " hours " + minutes + " minutes and " + seconds + " seconds.";
};

function startPing() {
  setInterval(function () {
    ws.send(JSON.stringify({ "type": "PING" }))
  }, 300000)
}

var TIMER_COOLDOWN = Date.now();
var TIMER_COOLDOWN_LENGTH = 1000 * 60 * 10;
var QUEUE = [];
var QUEUE_STATUS = false;
var LAST_STATUS = "";
var RECENT_FOLLOWS = Object.create(null)
settings.ACCESS = settings['BOT_OAUTH'].split(":")[1];

var ws = new WebSocket('wss://pubsub-edge.twitch.tv');

var sl = new StreamlabsSocketClient({
  token: settings.STREAMLABS,
  emitTests: true // true if you want alerts triggered by the test buttons on the streamlabs dashboard to be emitted. default false.
});

sl.connect();

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

bot.connect();

api.clientID = settings.CLIENTID;
var inbuilt_commands = Object.create(null);

inbuilt_commands = {
  "!addcom": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      if (commands[0][0] !== "!") {
        bot.action(settings.CHANNEL, "The command name must start with a ! choccy1Baka");
        return;
      };
      var output = commands.splice(1).join(" ");
      if (output[0] === '!') {
        bot.action(settings.CHANNEL, "The command output cannot start with a ! choccy1Baka");
      } else {
        dbCommands.set(commands[0], output);
        bot.action(settings.CHANNEL, "The command " + commands[0] + " has been added. choccy1ISee");
      }
    }
  },

  "!editcom": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      if (dbCommands.get(commands[0])) {
        dbCommands.update(commands[0], function (currentComand) {
          return commands.splice(1).join(" ");
        });
        bot.action(settings.CHANNEL, "The command " + commands[0] + " has been edited. choccy1ISee");
      };
    };
  },

  "!delcom": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      if (dbCommands.get(commands[0])) {
        dbCommands.rm(commands[0]);
        bot.action(settings.CHANNEL, "The command " + commands[0] + " has been deleted. choccy1ISee");
      };
    };
  },

  "!game": function (commands, userstate) {
    if (commands[0]) {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        api.channels.updateChannel({ channelID: settings.CHANNELID, auth: settings.ACCESS, game: commands.join(" ")}, function (err, res) {
           if (err) {
            console.warn(err);
            return;
           } else {
             bot.action(settings.CHANNEL, "Game has been updated to: " + commands.join(" ") + " choccy1ISee");
           };
        });
      };
    } else {
      api.channels.channel({ auth: settings.ACCESS}, function (err, res) {
        if (err) {
          console.warn(err);
        } else {
          bot.action(settings.CHANNEL, "Game is currently set to: " + res.game + " choccy1ISee");
        };
      });
    };
  },

  "!title": function(commands, userstate) {
    if (commands[0]) {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        api.channels.updateChannel({ channelID: settings.CHANNELID, auth: settings.ACCESS, status: commands.join(" ")}, function (err, res){
          if (err) {
            console.warn(err);
            return;
          } else {
            bot.action(settings.CHANNEL, "Title has been updated to: " + commands.join(" ") + " choccy1AYAYA");
          };
        });
      };
    } else {
      api.channels.channel({ auth: settings.ACCESS}, function (err, res) {
        if (err) {
          console.warn(err);
          return;
        } else {
          bot.action(settings.CHANNEL, "Title is currently set to: " + res.status + " choccy1AYAYA");
        };
      });
    };
  },

  "!queue": function(commands, userstate) {
    if (commands[0] === 'open') {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        QUEUE_STATUS = true;
        bot.action(settings.CHANNEL, "Queue is now open!! choccy1AYAYA ")
      };
    };

    if (commands[0] === 'close') {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        QUEUE_STATUS = false;
        bot.action(settings.CHANNEL, "Queue is now closed.. choccy1ISee")
      };
    };

    if (commands[0] === 'clear') {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        if (QUEUE_STATUS) {
          QUEUE = [];
          bot.action(settings.CHANNEL, "Queue has been cleared.. choccy1ISee");
        } else {
          bot.action(settings.CHANNEL, "Cannot clear an already closed queue.. choccy1Baka");
        }
      };
    };

    if (commands[0] === 'list') {
      if (QUEUE[0]) {
        QUEUE.forEach(function (username, position) {
          bot.action(settings.CHANNEL, (position + 1) + ": " + username);
        });
      } else {
        bot.action(settings.CHANNEL, "Queue is currently empty! choccy1Baka");
      }
    };

    if (commands[0] === 'leave') {
      if (QUEUE.indexOf(userstate.username) > -1) {
        var position = QUEUE.indexOf(userstate.username)
        QUEUE.splice(position, 1)
        bot.action(settings.CHANNEL, "@" + userstate['display-name'] + " You have left the queue.. choccy1ISee")
      } else {
        bot.action(settings.CHANNEL, "@" + userstate['display-name'] + " I do not think you are in the queue.. choccy1Baka")
      }
    }

    if (commands[0] === 'next') {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        if (QUEUE[0]) {
          bot.action(settings.CHANNEL, "@" + QUEUE.shift() + " is the next one in the queue. choccy1AYAYA")
          bot.action(settings.CHANNEL, "Up after: @" + QUEUE[0])
        } else {
          bot.action(settings.CHANNEL, "No more people in the queue.. choccy1Baka")
        }
      }
    }

    if (!commands[0]) {
      if (QUEUE_STATUS) {
        if (QUEUE.indexOf(userstate.username) === -1) {
          QUEUE.push(userstate.username)
          bot.action(settings.CHANNEL, "@" + userstate['display-name'] + " You have joined the queue in position " + (QUEUE.indexOf(userstate.username) + 1) + " choccy1AYAYA")
        } else {
          bot.action(settings.CHANNEL, "@" + userstate['display-name'] + " You have already joined the queue as position " + (QUEUE.indexOf(userstate.username) + 1) + "choccy1Baka")
        }
      } else {
        bot.action(settings.CHANNEL, "Queue is currently closed.. choccy1Baka")
      }
    }
  },

  "!uptime": function (commands, userstate) {
    api.streams.channel({ channelID: settings.CHANNELID }, function (err, res) {
      if (err) {
        console.warn(err);
        return;
      } else {
        if (res.stream) {
          bot.action(settings.CHANNEL, "@" + userstate['display-name'] +", the stream has been live for: " + uptime(res.stream.created_at) + " choccy1AYAYA");
        } else {
          bot.action(settings.CHANNEL, "@" + userstate['display-name'] + ", the stream is not live! choccy1Baka");
        };
      };
    });
  },

  "!shoutout": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      var streamer = commands[0][0] === '@' ? commands[0].substr(1).toLowerCase() : commands[0].toLowerCase()
      var i;
      for (i = 0; i <= 5; i++) {
        bot.action(settings.CHANNEL, "Go give " + commands[0] + " a follow at twitch.tv/" + streamer + " choccy1AYAYA");
      };
    };
  },

  "!vanish": function (commands, userstate) {
    if (userstate.mod) {
      bot.timeout(settings.CHANNEL, userstate.username, 1);
      setTimeout(function () {
        bot.mod(settings.CHANNEL, userstate.username);
      }, 1000);
    } else {
      bot.timeout(settings.CHANNEL, userstate.username, 1);
    }
  },

  "!commands": function(commands) {
    var data = Object.keys(inbuilt_commands);
    dbCommands.forEach(function (key) {
      data.push(key);
    });
    bot.action(settings.CHANNEL, data.join(" "));
  }
};

sl.on('follow', function (data) {
  bot.action(settings.CHANNEL, "@" + data.name + ", thank you for following! choccy1AYAYA")
});

sl.on('donation', function (data) {
  bot.action(settings.CHANNEL, "Donation from " + data.name + " (" + data.formatted_amount + "): " + data.message + " SpinTag")
});

bot.on("hosted", function (channel, username, viewers, autohost) {
  if (!autohost) bot.action(settings.CHANNEL, "Thank you @"  + username + " for the host! choccy1ISee");
});

bot.on("raided", function (channel, raider, viewers, userstate) {
  var raiders = viewers - 1;
  var i;
  for (i = 0; i <= raiders; i++) {
    bot.action(settings.CHANNEL, "choccy1AYAYA INCOMING " + raider.toUpperCase() + " RAID choccy1AYAYA");
  }
});

sl.on("bits", function (data) {
  bot.action(settings.CHANNEL, "@" + data.name + ", thank you for the " + data.formattedAmount + " bits you baka!! choccy1Baka" );
});

bot.on("subscription", function (channel, username) {
    bot.action(settings.CHANNEL, "@" + username + ", thank you for subscribing! ShuffleGible <3 <3");
});

bot.on("resub", function (channel, username, months, message, userstate, methods) {
    bot.action(settings.CHANNEL, "@" + username + ", thank you for the " + months + " month resub! ShuffleGible <3 <3");
});

bot.on("subgift", function (channel, username, recipient, plan, userstate) {
  bot.action(settings.CHANNEL, "Thank you "  + username + " for gifting a sub to " + recipient + "! ShuffleGible  <3 <3");
})

bot.on("chat", function (channel, userstate, message, self) {
  if (self) return;

  if (Date.now() - TIMER_COOLDOWN > TIMER_COOLDOWN_LENGTH) {
    bot.action(settings.CHANNEL, "AsukaStare .........");
    TIMER_COOLDOWN = Date.now();
  };

  if (message[0] === "!") {
    var commands = message.split(" ");

    if (inbuilt_commands[commands[0]]) {
      inbuilt_commands[commands[0]](commands.splice(1), userstate);
    };

    if (dbCommands.get(commands[0])) {
      bot.action(settings.CHANNEL, dbCommands.get(commands[0]));
    };
  }
});

sl.on("event", function (data) {
  console.log(data)
})

ws.on('open', function open() {
  startPing()

  ws.send(JSON.stringify({
    "type": "LISTEN",
    "nonce": "nice",
    "data": {
      "topics": ["video-playback." + settings.CHANNEL.toLowerCase(),
                 "channel-points-channel-v1." + settings.CHANNELID],
      "auth_token": settings.ACCESS
    }
  }))
});

ws.on('message', function incoming(payload) {
  var data = JSON.parse(payload);
  if (data.data) {
    if (data.data.message) {
      var message_parsed = JSON.parse(data.data.message);
      var message_type = message_parsed.type
      if (message_type === "stream-up") {
        if (LAST_STATUS === stream_status) return;
        LAST_STATUS = stream_status
        bot.action(settings.CHANNEL, 'choccy1ISee !! live')
      }
      if (message_type === 'stream-down') {
        if (LAST_STATUS === stream_status) return;
        LAST_STATUS = stream_status
        bot.action(settings.CHANNEL, 'AsukaStare .... finally I can sleep')
      }
      if (message_type === "reward-redeemed") {
        if (message_parsed.data["redemption"]["reward"]["title"] === "Timeout") {
          var victim = message_parsed.data["redemption"]["user_input"]
          bot.mods(settings.CHANNEL).then(function (chat_mods) {
            if (chat_mods.indexOf(victim) === -1) {
              bot.timeout(settings.CHANNEL, victim, 1, "Blame " + message_parsed.data["redemption"]["user"]["display_name"] + " ;)")
            } else {
              bot.timeout(settings.CHANNEL, victim, 1, "Blame " + message_parsed.data["redemption"]["user"]["display_name"] + " ;)");
              setTimeout(function () {
                bot.mod(settings.CHANNEL, victim);
              }, 1000);
            }
          }).catch(function (error) {
            console.log(error)
          })
        }
      }
    }
  }
});
