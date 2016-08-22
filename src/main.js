const redis = require('redis');
const winston = require('winston');
const parseArgs = require('minimist');
const config = require('./config');

const args = parseArgs(process.argv.slice(2));

const client = redis.createClient({
    host: config.host,
    port: config.port
});

const Repository = require('./repository.js');

const logger = new (winston.Logger)({
    level: args.logLevel || config.logLevel,
    transports: [
        new (winston.transports.Console)(),
        new (winston.transports.File)({ filename: new Date().getTime() + '.log' })
    ]
});
const repo = new Repository(client, logger, config.mutexTimeout);

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
        logger.log('generator');
        extendLock(lock);
    }, err => {
        if (err instanceof repo.MutexError) {
            consumer();
            logger.log('consumer');
        }
    });
}

function extendLock(lock) {
    lock.extend(config.mutexTimeout);
    setTimeout(() => extendLock(lock), config.mutexTimeout * .8);
}

function generator() {
    const message = getMessage();
    logger.debug('generated: ', message);
    repo.publishMessage(message)
        .then(() => timeout(config.generationTimeout))
        .then(generator);
}

function handleConsumingResult (error, msg) {
    if (error) {
        logger.error('consumed: ', msg, error);
        repo.publishErrorMessage(msg);
    } else {
        logger.debug('consumed: ', msg, error);
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

function consumeErrors() {
    repo.fetchAllErrorMessages().then(msgs => {
        if (msgs && msgs.length) {
            msgs.forEach((msg)=> console.log(msg));
            console.log(`There were ${msgs.length} error messages`);
        } else {
            console.log('There are no error messages.');
        }
        repo.clearErrorMessages().then(() => {
            console.log('Error message queue cleared');
        });
    });
}

if (args.getErrors) {
    consumeErrors();
} else {
    detectRole();
}


