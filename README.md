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
Serve the PHP site over HTTPS so login credentials and session cookies are
protected in transit.

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

## Setting up guide and editor accounts

Tourists can join without signing in. Guide mode and editor mode require an
account, and only editor accounts can save dataset changes. Accounts are
created and managed from the command line; there is no public registration or
web-based account administration.

1. **Configure the PHP application's MySQL connection.** Start your MySQL
   server (for example, in XAMPP) and open
   [`dist/app/Config/Database.php`](./dist/app/Config/Database.php). In the
   `$default` connection settings, enter the values for your installation:

   - `hostname`: where MySQL is running (usually `localhost` when it is on
     the same machine as PHP).
   - `username` and `password`: a MySQL account that can create tables in the
     application database.
   - `database`: the name of an existing MySQL database for GuidO.
   - `port`: the MySQL port (usually `3306`).

   Create the database first if it does not exist. The PHP command-line
   environment must use the same settings and have the PHP `mysqli` extension
   enabled; `php spark migrate` uses this connection to create the account
   table. Keep database credentials private and do not commit real production
   credentials to Git.
2. Set `GUIDO_AUTH_SECRET` to the same randomly generated secret on the PHP
   host and the Node.js host. Use at least 32 characters. Keep it private and
   do not commit it to the repository. PHP loads it from `dist/.env`, for
   example. Generate a value with:

   ```sh
   php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
   ```

   Put the generated value in `dist/.env`:

   ```text
   GUIDO_AUTH_SECRET = "paste-the-generated-value-here"
   ```

   Set the same variable in the environment used to start the Node.js process.
   For example, in PowerShell:

   ```powershell
   $env:GUIDO_AUTH_SECRET = "paste-the-same-generated-value-here"
   ```

3. From the `dist` directory, create the account table and an account:

   ```sh
   php spark migrate
   php spark guido:user:create
   ```

   The command securely prompts for a password and asks which roles to assign:
   `guide`, `editor`, or both. Running it again for an existing username
   updates that account's password and roles.

After signing in, use `/tours/<dataset>?role=guide` or
`/tours/<dataset>?role=editor`, replacing `<dataset>` with the dataset
directory name. The account must have the corresponding role. Passwords are
stored as password hashes, and the guide permission is verified by both the
PHP application and the Node.js server.

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
