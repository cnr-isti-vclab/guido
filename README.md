# guido
Remote guided tour panorama application.

## Installing GuidO on your machine

## Requirements

GuidO requires two servers. They can run on the same machine, but they serve
different parts of the application:

1. **An HTTP server with PHP** serves the CodeIgniter website and its pages
   (for example, Apache through XAMPP on Windows, or Apache on Ubuntu).
2. **A Node.js server running mediasoup** provides the real-time tour features,
   including Socket.IO connections, chat, user presence, and audio/video
   streaming. This is a separate process from the PHP/HTTP server.

The browser needs to be able to reach both servers. The PHP site serves the
tour page; the page connects to the Node.js server for real-time features.

## Starting the HTTP server

Configure the HTTP server's document root to the project's `dist/public`
directory, not the repository root or `dist` directory. For Apache, point
`DocumentRoot` to the full path of `dist/public` and allow that directory to
use its `.htaccess` file so CodeIgniter can route requests through
`index.php`. For example:

```apache
DocumentRoot "/path/to/guido/dist/public"

<Directory "/path/to/guido/dist/public">
    AllowOverride All
    Require all granted
</Directory>
```

Replace `/path/to/guido` with the actual location of the project on your
machine, then start or reload Apache. Open the site using the host and port
configured for Apache.

## Starting the mediasoup server

Install the Node.js dependencies from the project root:

```sh
npm install
```

Configure the Node.js server in [`server/config.js`](./server/config.js):

- Set `listenIp` and `listenPort` for the HTTPS/Socket.IO listener. The default
  port is `8080`.
- Set `sslCrt` and `sslKey` to the TLS certificate and private key files. The
  server will not start if those files cannot be found.
- Set `mediasoup.webRtcTransport.listenIps` to the server's reachable IP
  address. When behind NAT, configure `announcedIp` to the public IP address.
- Configure the mediasoup worker's `rtcMinPort` and `rtcMaxPort` to the UDP
  port range allowed through the server firewall. The defaults are `10000` and
  `20000`.

Run the Node.js service from the project root:

```sh
node server/GuidoServer.js
```

Allow inbound traffic to the configured HTTPS listener port and the mediasoup
UDP port range in the server firewall. The HTTPS listener uses the `/server`
path for Socket.IO.

The Node.js server address used by the tour page is configured in
[`dist/app/Config/Guido.php`](./dist/app/Config/Guido.php). Set its `host`
property to the Node.js server's reachable HTTPS base URL (for example,
`https://your-server.example:8080`). The PHP site must also be configured and
served by the HTTP/PHP server.


