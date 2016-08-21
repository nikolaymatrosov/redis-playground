const redis = require('redis');
const client = redis.createClient({
    host: '127.0.0.1',
    port: 6379
});
const config = require('./config');
const Repository = require('./repository.js');

const repo = new Repository(client, config.mutexTimeout);

function getMessage() {
    this.cnt = this.cnt || 0;
    return this.cnt++;
}
function timeout(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, milliseconds);
    });
}


function eventHandler(msg, callback) {
    function onComplete() {
        var error = Math.random() > 0.85;
        callback(error, msg);
    }

    // processing takes time...
    setTimeout(onComplete, Math.floor(Math.random() * config.consumingTimeout));
}

// try to get mutex
function detectRole() {
    repo.lock().then(lock => {
        generator();
        console.log('generator');
        extendLock(lock);
    }, err => {
        if (err instanceof repo.MutexError) {
            consumer();
            console.log('consumer');
        }
    });
}

function extendLock(lock) {
    lock.extend(config.mutexTimeout);
    setTimeout(() => extendLock(lock), config.mutexTimeout * .8);
}

function generator() {
    const message = getMessage();
    console.log('generated: ', message);
    repo.publishMessage(message)
        .then(() => timeout(config.generationTimeout))
        .then(generator);
}

function handleConsumingResult (error, msg) {
    console.log('consumed: ', msg, error);
    if (error) {
        repo.publishErrorMessage(msg);
    }
    consumer();
}


function consumer() {
    repo.fetchMessage().then(msg => {
        if (msg !== null) {
            eventHandler(msg, handleConsumingResult);
        } else {
            timeout(config.generationTimeout)
                .then(() => detectRole());
        }
    });
}

detectRole();

