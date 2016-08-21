const redis = require('redis');
const client = redis.createClient({
    host: '127.0.0.1',
    port: 6379
});
const config = require('./config');

client.on('error', function (err) {
    console.log('Error ' + err);
});

client.del(config.publisherMutex, redis.print);
client.del(config.corruptMessages, redis.print);
client.del(config.generatedMessages, redis.print);
const clientCounter = 'client-counter';

client.set(clientCounter, 0, redis.print);
client.rpop(config.generatedMessages, (err, msg) => {
    if (err) {
        console.error(err);
    } else {
        console.log(msg);
    }
});

client.get(clientCounter, (err, res) => {
    console.log(res);
    client.quit();
});
