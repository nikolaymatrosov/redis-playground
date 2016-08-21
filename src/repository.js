/**
 * Created by n.matrosov on 8/21/2016.
 */
const util = require('util');
const config = require('./config');

const unlockScript = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
const extendScript = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end';

function MutexError(message) {
    Error.call(this);
    Error.captureStackTrace(this, MutexError);
    this.name = 'LockError';
    this.message = message || 'Failed to lock the resource.';
}

util.inherits(MutexError, Error);

class Lock {
    constructor(repo, resource, value, expiration) {
        this.repo = repo;
        this.resource = resource;
        this.value = value;
        this.expiration = expiration;
    }

    unlock() {
        return this.repo.unlock();
    }

    extend(ttl) {
        return this.repo.extend(this, ttl);
    }
}


class Repository {
    constructor(client, ttl) {
        this.client = client;
        this.ttl = ttl;
        this.value = Repository.randomValue();
        this.driftFactor = 0.01;
        this.MutexError = MutexError;
    }

    extend(lock) {
        if (lock.expiration < Date.now()) {
            return Promise.reject(new Error('Cannot extend lock on resource "' + lock.resource + '" because the lock has already expired.'));
        }

        return this.lock().then((extension) => {
            lock.value      = extension.value;
            lock.expiration = extension.expiration;
            return lock;
        });
    }

    getMutexValue() {
        return new Promise((resolve, reject) => {
            this.client.get(config.publisherMutex, (err, currentValue)=> {
                if (err) {
                    reject(err);
                } else {
                    resolve(currentValue);
                }
            });
        });
    }

    lock() {
        return new Promise((resolve, reject) => {
            var request;
            this.getMutexValue()
                .then(currentValue => {
                    if (currentValue !== null && this.value != currentValue) {
                        reject(new MutexError());
                    } else {
                        if (!currentValue) {
                            request = (client, cb) => {
                                return client.set(config.publisherMutex, this.value, 'NX', 'PX', this.ttl, cb);
                            };
                        } else {
                            request = (client, cb) => {
                                return client.eval(extendScript, 1, config.publisherMutex, this.value, this.ttl, cb);
                            };
                        }
                        return request(this.client, checkResult);
                    }
                });

            const checkResult = (function checkResult (err) {
                const start = Date.now();

                if (err) {
                    reject(err);
                }

                var drift = Math.round(this.driftFactor * this.ttl) + 2;
                var lock = new Lock(this, config.publisherMutex, this.value, start + this.ttl - drift);

                if (lock.expiration > Date.now()) {
                    resolve(lock);
                } else {
                    reject('Expired');
                }


            }).bind(this);

        });
    }

    unlock(){
        return new Promise((resolve, reject) => {
            function checkResult (err) {
                if (err) {
                    reject(err);
                }
                return resolve();

            }

            this.client.eval(unlockScript, 1, config.publisherMutex, this.value, checkResult);
        });
    }

    publishMessage(message) {
        return this._pushMessageTo(config.generatedMessages, message);
    }

    publishErrorMessage(message) {
        return this._pushMessageTo(config.corruptMessages, message);
    }

    _pushMessageTo(channel, msg) {
        return new Promise((resolve, reject) => {
            this.client.lpush(channel, msg, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    fetchMessage(){
        return new Promise((resolve, reject) => {
            this.client.rpop(config.generatedMessages, (err, msg) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(msg);
                }
            });
        });
    }

    fetchAllErrorMessages() {
        return new Promise((resolve, reject) => {
            this.client.lrange(config.corruptMessages, 0, -1, (err, msgs) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(msgs);
                }
            });
        });
    }

    static randomValue() {
        return Math.random().toString(36).slice(2);
    }

}

module.exports = Repository;
