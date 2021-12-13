const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {	
	serveClient: false,
	cors: {
		origin: "*",
		methods: ["GET", "POST"]
	}
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

let last_status = null;
io.on('connection', (socket) => {
	if(last_status)
		socket.emit('follow', last_status);

	socket.on('guide2pi', (status) => {
		last_status = status;
		console.log(status); //'room: ' + status.room, 'lat: ' + status.lat.toFixed(2), 'lon: ' + status.lon.toFixed(2));
		status.count = io.engine.clientsCount;
		socket.broadcast.emit('follow', status);
		socket.emit('follow', { count: status.count });
	});
  
});

let port = 8080
server.listen(port, () => {
  console.log(`listening on *:${port}`);
});
