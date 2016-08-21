const redis = require('redis');
const assert = require('chai').assert;
const Repository = require('../src/repository.js');
const config = require('../src/config');

const client1 = redis.createClient();
const client2 = redis.createClient();
const repo = new Repository(client1, 1000);
const repo2 = new Repository(client2, 1000);

describe('Repository', () => {

    beforeEach(() => {
        client1.del(config.publisherMutex, redis.print);
    });

    it('can lock publisher mutex', (done) => {
        repo.lock().then(lock => {
            assert.isDefined(lock.expiration);
            done();
        }, err => {
            done(err);
        });
    });

    it('should be locked', (done)=> {
        repo.lock().then(() => {
            repo2.lock().then(() => {
                done(new Error('Mutex should be taken'));
            }, err => {
                assert(err instanceof repo.MutexError);
                done();
            });
        });
    });

    it('can extend lock', (done) => {
        repo.lock().then(lock => {
            assert.isDefined(lock.expiration);
            const oldExpiration = lock.expiration;
            lock.extend(1000).then((newLock) => {
                assert(newLock.expiration > oldExpiration);
                done();
            });
        }, err => {
            done(err);
        });
    });

})
;
