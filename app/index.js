

/**
 * 
 * 
 * @class GameCore
 * @constructor
 * @param {Array} models Objects defining a "type" and "construct" method to create objects based on
 * 		objects
 * @param {Array} [extensions] Array of additional parts to incorporate into the Universe.
 * @param {Object} [configuration] The configuration. Defaults to default a-configuration require.
 * @param {Object} [log] What to use for the log factors. Defaults to console.
 */
module.exports = function(configuration, models, handlers, log) {
	require("./extensions/array.js");
	var Universe = require("./universe"),
		WebSocket = require("ws"),
		URL = require("url").URL,
		HTTPS = require("https"),
		HTTP = require("http"),
		fs = require("fs"),
	
		options = {},
		universe,
		handler,
		server,
		log;
	
	if(!configuration) {
		configuration = require("a-configuration");
	}
	log = log || configuration.log || console;
	universe = new Universe(configuration, models, handlers);
	universe.on("error", function(event) {
		log.error(event);
	});
	universe.on("online", function(event) {
		log.info(event);
	});
	universe.on("warning", function(event) {
		log.warn(event);
	});
	
	if(configuration.server.key) {
		options.ca = fs.readFileSync(configuration.server.interm || configuration.server.certificateAuthority || configuration.server.ca, "utf-8");
		options.cert = fs.readFileSync(configuration.server.certificate || configuration.server.crt || configuration.server.public, "utf-8");
		options.key = fs.readFileSync(configuration.server.privateKey || configuration.server.key || configuration.server.private, "utf-8");
		server = HTTPS.createServer(options);
	} else {
		server = HTTP.createServer();
	}
	
	options.noServer = true;
	handler = new WebSocket.Server(options);
	// This is essentially an extra bounce, can be moved to a direct Universe connection or at least out of the core server initialization for clarity
	handler.on("connection", function(connection, request) {
		log.info({
			"user": connection.user,
			"ip": request.ip
		}, "New Connection Received");
		
		connection.session = request.session;
		connection.request = request;
		connection.host = request.ip;
		
		if(request.session) {
			connection.username = request.session.username;
			connection.name = request.session.name;
			connection.id = request.session.id;
		} else {
			connection.username = request.url.searchParams.get("username");
			connection.name = request.url.searchParams.get("name");
			connection.id= request.url.searchParams.get("id");
		}
		
//		console.log("Registering Client: ", connection.session);
		universe.connectPlayer(connection);
	});
	
	server.on("upgrade", function(request, socket, head) {
		request.url = new URL("http://self" + request.url);
//		console.log("Upgrade URL: ", request.url);
	
		if(request.url.pathname === "/connect") {
			request.query = request.url.query; // This doesn't appear to be handled by WS
			request.path = request.url.pathname;
			
//			console.log("Verifying Client: ", request.query);
			if(configuration.sessions && configuration.sessions.verify) {
				configuration.sessions.verify(request)
				.then(function(session) {
					if(session) {
						log.info({"req": request, "session": session}, "Websocket accepted");
						request.session = session;
						handler.handleUpgrade(request, socket, head, function(ws) {
							handler.emit("connection", ws, request);
						});
					} else {
						log.warn({"req": request}, "Rejected websocket request for lack of session");
						// TODO: Respond nicely
						socket.destroy();
					}
				}).catch(function(error) {
					log.error({"error": error, "stack": error.stack, "req": info.req}, "Failed to find session data for user while verifying websocket client: " + error.message);
					// TODO: Respond nicely
					socket.destroy();
				});
			} else {
				handler.handleUpgrade(request, socket, head, function(ws) {
					handler.emit("connection", ws, request);
				});
			}
		} else {
			socket.destroy();
		}
	});
	
	server.listen(configuration.server.port);
};

var configuration = require("a-configuration");
configuration._await
.then(function() {
	var utilityHandler = require("./handlers/utility"),
		itemHandler = require("./handlers/items/exchange"),
		roomHandler = require("./handlers/rooms/exchange"),
		characterHandler = require("./handlers/character"),
		masterHandlers = require("./handlers/master"),
		messageHandler,
		playerHandler,
		nounHandler,
		
		handlers = [],
		models = [];

	utilityHandler.registerNoun("modifierattrs", models, handlers);
	utilityHandler.registerNoun("modifierstats", models, handlers);
	utilityHandler.registerNoun("archetype", models, handlers);
	utilityHandler.registerNoun("inventory", models, handlers);
	utilityHandler.registerNoun("knowledge", models, handlers);
	utilityHandler.registerNoun("condition", models, handlers);
	utilityHandler.registerNoun("itemtype", models, handlers);
	utilityHandler.registerNoun("loglevel", models, handlers);
	utilityHandler.registerNoun("location", models, handlers);
	utilityHandler.registerNoun("playlist", models, handlers);
	utilityHandler.registerNoun("ability", models, handlers);
	utilityHandler.registerNoun("dataset", models, handlers);
	utilityHandler.registerNoun("loadout", models, handlers);
//	utilityHandler.registerNoun("history", models, handlers);
	utilityHandler.registerNoun("entity", models, handlers);
	utilityHandler.registerNoun("effect", models, handlers);
//	utilityHandler.registerNoun("planet", models, handlers);
	utilityHandler.registerNoun("widget", models, handlers);
	utilityHandler.registerNoun("image", models, handlers);
	utilityHandler.registerNoun("party", models, handlers);
	utilityHandler.registerNoun("skill", models, handlers);
	utilityHandler.registerNoun("note", models, handlers);
	utilityHandler.registerNoun("book", models, handlers);
	utilityHandler.registerNoun("item", models, handlers);
	utilityHandler.registerNoun("race", models, handlers);
	utilityHandler.registerNoun("room", models, handlers);
	utilityHandler.registerNoun("slot", models, handlers);
	utilityHandler.registerNoun("sex", models, handlers);

	handlers.push(characterHandler.create);
	handlers.push(masterHandlers.control);
	handlers.push(itemHandler.give);
	handlers.push(itemHandler.take);
	handlers.push(roomHandler.give);
	handlers.push(roomHandler.take);
	
	new module.exports(configuration, models, handlers);
}).catch(function(err) {
	console.log("Err: ", err);
});
