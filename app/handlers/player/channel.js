
/**
 * 
 * @class Player
 * @extends EventEmitter
 * @constructor
 * @param {Object} connection
 */
var EventEmitter = require("events").EventEmitter,
	Random = require("rs-random"),
	util = require("util"),
	keys = [
		"username",
		"master",
		"entity",
		"email",
		"name",
		"id"
	];

module.exports = function(universe, details) {
	this.connections = 0;
	this.leaves = 0;
	this.last = 0;
	
	var connections = [],
		standardEvents,
		player = this,
		masterEvents,
		globalEvents,
		listeners,
		x;
	
	for(x=0; x<keys.length; x++) {
		this[keys[x]] = details[keys[x]];
	}
	
	/**
	 * 
	 * @method connect
	 * @param {WebSocket} socket
	 */
	this.connect = function(socket) {
		player.last = Date.now();
		connections.push(socket);
		player.connections++;
		var buffer,
			cache;

		socket.connect_id = Random.identifier("connection");
		
		socket.onmessage = function(event) {
			var message = JSON.parse(event.data);
			message = {
				"type": "player",
				"event": message.event,
				"eventType": "player:" + message.event,
				"player": player,
				"data": message.data,
				"received": Date.now(),
				"sent": parseInt(message.sent)
			};

//			console.log("Player Message [" + (message.received - message.sent) + "ms]: " + player.username + "\n", message);
			
			setTimeout(function() {
				player.last = Date.now();
				try {
					universe.emit(message.eventType, message);
//					console.log("Player Message Emitted");
				} catch(violation) {
					var event = {
						"received": Date.now(),
						"error": violation,
						"cause": message
					};
					this.emit("error", event);
				}
			});
		};
		
		socket.onclose = function(event) {
			connections.purge(socket);
			player.connections--;
			player.leaves++;
			
			var event = {};
			event.message = event.message;
			event.received = Date.now();
			event.signal = "close";
			event.player = player;
			event.event = event;
			
			setTimeout(function() {
				universe.emit("disconnected", event);
			});
		};
		
		socket.onerror = function(error) {
			sockets.purge(socket);
			
			var event = {};
			event.message = error.message;
			event.received = Date.now();
			event.signal = "error";
			event.player = player;
			setTimeout(function() {
				universe.emit("error", event);
			});
		};
		
		var state = {
			"event": universe.currentState(player),
			"type": "world:state",
			"sent": Date.now(),
			"master": player.master
		};
		
		universe.emit("player:connected", player);
		socket.send(JSON.stringify(state));
	};
	
	/**
	 * 
	 * @method send
	 * @param {Object} event
	 */
	var send = this.send = function(event) {
		event.sent = Date.now();
		var data = JSON.stringify(event);
		for(var x=0; x<connections.length; x++) {
//			console.log("Sending... ", event);
			connections[x].send(data);
		}
	};
	
	standardEvents = [
		"model:modified",
		"player:whisper",
		"model:deleted",
		"control",
	];
	
	masterEvents = [
		"universe:console",
		"master:speak"
	];
	
	globalEvents = [
		"universe:modified",
		"universe:error",
		"error"
	];
	
	listeners = {
		// Special Logic conditions
		"player:connected": function (connecting) {
			if(connecting.user !== player.user) {
				send({
					"classification": "non-standard",
					"type": "player:connected",
					"event": connecting,
					"sent": Date.now()
				});
			}
		}
	};
	
	standardEvents.forEach(function(eventType) {
		listeners[eventType] = function(event) {
			if(player.master || !event.relevent || event.relevent.indexOf(player.id) !== -1) {
				send({
					"classification": "standard",
					"emitted": event.emitted,
					"event": event,
					"echo": event.echo,
					"sent": Date.now(),
					"type": eventType
				});
			}
		};
	});
	
	masterEvents.forEach(function(eventType) {
		listeners[eventType] = function(event) {
			if(player.master) {
				send({
					"classification": "master",
					"emitted": event.emitted,
					"event": event,
					"echo": event.echo,
					"sent": Date.now(),
					"type": eventType
				});
			}
		};
	});
	
	globalEvents.forEach(function(eventType) {
		listeners[eventType] = function(event) {
			send({
				"classification": "global",
				"emitted": event.emitted,
				"event": event,
				"echo": event.echo,
				"sent": Date.now(),
				"type": eventType
			});
		};
	});

	Object.keys(listeners).forEach(function(event) {
		universe.on(event, listeners[event]);
	});
};

util.inherits(module.exports, EventEmitter);
