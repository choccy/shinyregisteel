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
settings.ACCESS = settings['OWNER_OAUTH'].split(":")[1];

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

api.clientID = settings.CLIENTID;
var inbuilt_commands = Object.create(null);

inbuilt_commands = {
  "!addcom": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      if (commands[0][0] !== "!") {
        bot.say(settings.CHANNEL, "The command name must start with a ! SHIREE");
        return;
      };
      var output = commands.splice(1).join(" ");
      if (output[0] === '!') {
        bot.say(settings.CHANNEL, "The command output cannot start with a ! MahoHuh");
      } else {
        dbCommands.set(commands[0], output);
        bot.say(settings.CHANNEL, "The command " + commands[0] + " has been added. arisuHappy");
      }
    }
  },

  "!editcom": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      if (dbCommands.get(commands[0])) {
        dbCommands.update(commands[0], function (currentComand) {
          return commands.splice(1).join(" ");
        });
        bot.say(settings.CHANNEL, "The command " + commands[0] + " has been edited. HungryTag");
      };
    };
  },

  "!delcom": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      if (dbCommands.get(commands[0])) {
        dbCommands.rm(commands[0]);
        bot.say(settings.CHANNEL, "The command " + commands[0] + " has been deleted. HungryTag");
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
             bot.say(settings.CHANNEL, "Game has been updated to: " + commands.join(" ") + " KurisuFact");
           };
        });
      };
    } else {
      api.channels.channel({ auth: settings.ACCESS}, function (err, res) {
        if (err) {
          console.warn(err);
        } else {
          bot.say(settings.CHANNEL, "Game is currently set to: " + res.game + " KurisuFact");
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
            bot.say(settings.CHANNEL, "Title has been updated to: " + commands.join(" ") + " KurisuFact");
          };
        });
      };
    } else {
      api.channels.channel({ auth: settings.ACCESS}, function (err, res) {
        if (err) {
          console.warn(err);
          return;
        } else {
          bot.say(settings.CHANNEL, "Title is currently set to: " + res.status + " KurisuFact");
        };
      });
    };
  },

  "!queue": function(commands, userstate) {
    if (commands[0] === 'open') {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        QUEUE_STATUS = true;
        bot.say(settings.CHANNEL, "Queue is now open ErynSippyn ")
      };
    };

    if (commands[0] === 'close') {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        QUEUE_STATUS = false;
        bot.say(settings.CHANNEL, "Queue is now closed FeelsBadMan 🥃 ")
      };
    };

    if (commands[0] === 'clear') {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        if (QUEUE_STATUS) {
          QUEUE = [];
          bot.say(settings.CHANNEL, "Queue cleared from all normies KannaNormiesOut ");
        } else {
          bot.say(settings.CHANNEL, "Cannot clear an already closed queue hisoDerpDerpingOutHisWindow ");
        }
      };
    };

    if (commands[0] === 'list') {
      if (QUEUE[0]) {
        QUEUE.forEach(function (username, position) {
          bot.say(settings.CHANNEL, (position + 1) + ": " + username);
        });
      } else {
        bot.say(settings.CHANNEL, "Queue is currently empty! D:");
      }
    };

    if (commands[0] === 'leave') {
      if (QUEUE.indexOf(userstate.username) > -1) {
        var position = QUEUE.indexOf(userstate.username)
        QUEUE.splice(position, 1)
        bot.say(settings.CHANNEL, "@" + userstate['display-name'] + " You have left the queue Salutezume")
      } else {
        bot.say(settings.CHANNEL, "@" + userstate['display-name'] + " I do not think you are in the queue anyway hisoDerpDerpingOutHisWindow ")
      }
    }

    if (commands[0] === 'next') {
      if (userstate.mod || userstate.username === settings.CHANNEL) {
        if (QUEUE[0]) {
          bot.say(settings.CHANNEL, "@" + QUEUE.shift() + " is the next one in the queue UzukiGanbarimasu ")
          bot.say(settings.CHANNEL, "Up after: @" + QUEUE[0])
        } else {
          bot.say(settings.CHANNEL, "No more people in the queue Jebaited")
        }
      }
    }

    if (!commands[0]) {
      if (QUEUE_STATUS) {
        if (QUEUE.indexOf(userstate.username) === -1) {
          QUEUE.push(userstate.username)
          bot.say(settings.CHANNEL, "@" + userstate['display-name'] + " You have joined the queue in position " + (QUEUE.indexOf(userstate.username) + 1) + " AYAYABASS")
        } else {
          bot.say(settings.CHANNEL, "@" + userstate['display-name'] + " You have already joined the queue as position " + (QUEUE.indexOf(userstate.username) + 1) + " KannaPeer")
        }
      } else {
        bot.say(settings.CHANNEL, "Queue is currently closed MingLow 🥃 ")
      }
    }
  },

  "!uptime": function (commands) {
    api.streams.channel({ channelID: settings.CHANNELID }, function (err, res) {
      if (err) {
        console.warn(err);
        return;
      } else {
        if (res.stream) {
          bot.say(settings.CHANNEL, "The stream has been live for: " + uptime(res.stream.created_at) + " OhISee");
        } else {
          bot.say(settings.CHANNEL, "The stream is not live. cmonBruh");
        };
      };
    });
  },

  "!shoutout": function (commands, userstate) {
    if (userstate.mod || userstate.username === settings.CHANNEL) {
      var streamer = commands[0][0] === '@' ? commands[0].substr(1).toLowerCase() : commands[0].toLowerCase()
      var i;
      for (i = 0; i <= 5; i++) {
        bot.say(settings.CHANNEL, "Go give " + commands[0] + " a follow at twitch.tv/" + streamer + " Pog");
      };
    };
  },

  "!vanish": function (commands, userstate) {
    if (userstate.mod) {
      owner.timeout(settings.CHANNEL, userstate.username, 1);
      setTimeout(function () {
        owner.mod(settings.CHANNEL, userstate.username);
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
    bot.say(settings.CHANNEL, data.join(" "));
  }
};

sl.on('follow', function (data) {
  bot.action(settings.CHANNEL, " Thank you " + data.name + " for following! sealW ")
});

sl.on('donation', function (data) {
  bot.action(settings.CHANNEL, "Donation from " + data.name + " (" + data.formatted_amount + "): " + data.message + " SpinTag")
});

owner.on("hosted", function (channel, username, viewers, autohost) {
  if (!autohost) bot.action(settings.CHANNEL, "Thank you @"  + username + " for the host! Daijoubu ");
});

owner.on("raided", function (channel, raider, viewers, userstate) {
  var raiders = viewers - 1;
  var i;
  for (i = 0; i <= raiders; i++) {
    bot.action(settings.CHANNEL, "Pog INCOMING " + raider.toUpperCase() + " RAID Pog");
  }
});

bot.on("cheer", function (channel, userstate, message) {
  bot.action(settings.CHANNEL, "Thank you " + userstate.username + " for the " + userstate.bits + " bits!!! IAStare" );
});

bot.on("subscription", function (channel, username) {
    bot.action(settings.CHANNEL, "Thank you "  + username + " for subscribing! PaPaTuTuWaWa  <3 <3");
});

bot.on("resub", function (channel, username, months, message, userstate, methods) {
    bot.action(settings.CHANNEL, "Thank you "  + username + " for the " + months + " month resub! RoWOW <3 <3");
});

bot.on("subgift", function (channel, username, recipient, plan, userstate) {
  bot.action(settings.CHANNEL, "Thank you "  + username + " for gifting a sub to " + recipient + "! MomijiFeelsGreat  <3 <3");
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
      bot.say(settings.CHANNEL, dbCommands.get(commands[0]));
    };
  }
});

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
        bot.say(settings.CHANNEL, 'AsukaStare .... another shift modding this chat')
      }
      if (message_type === 'stream-down') {
        if (LAST_STATUS === stream_status) return;
        LAST_STATUS = stream_status
        bot.say(settings.CHANNEL, 'AsukaStare .... finally I can sleep')
      }
      if (message_type === "reward-redeemed") {
        if (message_parsed.data["redemption"]["reward"]["title"] === "Timeout") {
          var victim = message_parsed.data["redemption"]["user_input"]
          owner.mods(settings.CHANNEL).then(function (chat_mods) {
            if (chat_mods.indexOf(victim) === -1) {
              bot.timeout(settings.CHANNEL, victim, 1, "Blame " + message_parsed.data["redemption"]["user"]["display_name"] + " ;)")
            } else {
              owner.timeout(settings.CHANNEL, victim, 1, "Blame " + message_parsed.data["redemption"]["user"]["display_name"] + " ;)");
              setTimeout(function () {
                owner.mod(settings.CHANNEL, victim);
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
