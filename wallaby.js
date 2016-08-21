module.exports = function () {
    return {
        files: [
            'src/**/*.js'
        ],

        tests: [
            'test/**/*.spec.js'
        ],
        testFramework: 'mocha',
        env: {
            type: 'node',
            runner: 'node'
        }
    };
};