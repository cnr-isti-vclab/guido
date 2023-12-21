const http = require('node:http');
const fs = require('node:fs');

// Creazione del server HTTP
const server = http.createServer((req, res) => {
    // Abilita il CORS (Cross-Origin Resource Sharing)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        // Gestisci la richiesta OPTIONS per consentire il CORS
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/') {
        console.log('Richiesta ricevuta:', req.method, req.url);
        switch (req.method) {
            case 'POST':
                // Gestisci la richiesta POST
                let data = '';

                // Ricevi i dati dal corpo della richiesta
                req.on('data', chunk => {
                    data += chunk;
                });

                // Una volta completata la ricezione dei dati
                req.on('end', () => {
                    const parsedData = JSON.parse(data);
                    
                    // Salvo le modifiche nel file 'data.json'
                    fs.writeFile('data.json', JSON.stringify(parsedData, null, '\t'), (err) => {
                        if (err) {
                            console.error('Errore durante il salvataggio su file:', err);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Errore durante il salvataggio su file' }));
                        } else {
                            console.log('Dati salvati su file data.json');
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ message: 'Dati ricevuti e salvati con successo!' }));
                        }
                    });
                });
                break;
            default:
                break;
        }
    }
    // Gestisci altri percorsi
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
});

// Metti il server in ascolto sulla porta 3000 e sull'indirizzo 127.0.0.1
const PORT = 3000;
const HOST = '127.0.0.1';
server.listen(PORT, HOST, () => {
    console.log(`Server in ascolto su http://${HOST}:${PORT}`);
});
