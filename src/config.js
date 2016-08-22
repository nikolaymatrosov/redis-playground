/**
 * Created by n.matrosov on 8/21/2016.
 */
const config ={
    host: '127.0.0.1',
    port: 6379,
    logLevel: 'info',
    publisherMutex: 'Publisher:mutex',
    generatedMessages: 'CorrectMessageList',
    corruptMessages: 'CorruptMessageList',
    generationTimeout: 500,
    consumingTimeout: 1000,
    mutexTimeout: 2000
};

module.exports = config;