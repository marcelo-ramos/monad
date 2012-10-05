// vow.js
// Douglas Crockford
// 2012-10-04

// Public Domain

/*jslint es5: true */

var setTimeout, setImmediate;

if (typeof setImmediate !== 'function') {
    setImmediate = function setImmediate(func, param) {
        'use strict';
        return setTimeout(function () {
            func(param);
        }, 0);
    };
}


var VOW = (function () {
    'use strict';

// The VOW object contains a .make function that is used to make vows.
// It may also contain other useful functions.
// In some mythologies, vow is called defer.


    function enqueue(
        queue,      // An array of resolve functions
        func,       // A function that was registered with the .when method
        resolver,   // A resolve function to append to the queue
        breaker     // A break resolve function to be used if func fails
    ) {

// enqueue is a helper function used by .when. It will append a resolution to
// either the keepers queue or the breakers queue. If func is a function then
// push a new resolution function that will attempt to pass the result of the
// func to the resolver function; if that fails, then call the breaker function
// to recover. If func is not a function (which could happen if .when was called
// with missing arguments) then push the resolver function itself, which has the
// effect of passing the value down to the next .when, if the whens are chained.
// If the result of func is a promise, then the resolver or breaker will be
// called when that promise resolves.

        queue[queue.length] = typeof func === 'function'
            ? function (value) {
                try {
                    var result = func(value);
                    if (resolver(result.is_promise !== true)) {
                        resolver(result);
                    } else {
                        result.when(resolver, breaker);
                    }
                } catch (e) {
                    breaker(e);
                }
            }
            : resolver;
    }

    function enlighten(queue, fate) {

// enlighten is a helper function of herald and .when. It schedules the
// processing of all of the resolution functions in either the keepers queue
// or the breakers queue in later turns with the promise's fate.

        queue.forEach(function (func) {
            setImmediate(func, fate);
        });
    }

    return {
        make: function make() {

// The make function makes new vows. A vow contains a promise object and the
// two resolution functions: break and keep that determine the fate of the
// promise.

            var breakers = [],          // .when's broken queue
                fate,                   // The promise's ultimate value
                keepers = [],           // .when's kept queue
                status = 'pending';     // 'broken', 'kept', or 'pending'

            function herald(state, value, queue) {

// The herald function is a helper function of break and keep.
// It seals the promise's fate, updates its status, enlightens one of the
// queues, and empties both queues.

                if (status !== 'pending') {
                    throw "overpromise";
                }
                fate = value;
                status = state;
                enlighten(queue, fate);
                keepers.length = 0;
                breakers.length = 0;
            }

// Construct and return the vow object.

            return {
                break: function (value) {

// The break method breaks the promise.

                    herald('broken', value, breakers);
                },
                keep: function keep(value) {

// The keep method keeps the promise.

                    herald('kept', value, keepers);
                },
                promise: {
                    is_promise: true,

// The .when method is the promise monad's bind. The .when method can take two
// optional functions. One of those functions will be called, depending on the
// promise's resolution.

                    when: function (kept, broken) {

// Make a new vow. The promise will be the return value.

                        var vow = make();
                        switch (status) {

// If the promise is still pending, then enqueue both arguments.

                        case 'pending':
                            enqueue(keepers,  kept,   vow.keep,  vow.break);
                            enqueue(breakers, broken, vow.break, vow.break);
                            break;

// If the promise has already been kept, then enqueue only the kept function,
// and enlighten.

                        case 'kept':
                            enqueue(keepers, kept, vow.keep, vow.break);
                            enlighten(keepers, fate);
                            break;

// If the promise has already been broken, then enqueue only the broken
// function, and enlighten.

                        case 'broken':
                            enqueue(breakers, broken, vow.break, vow.break);
                            enlighten(breakers, fate);
                            break;
                        }
                        return vow.promise;
                    }
                }
            };
        },
        every: function every(array) {

// The every function takes an array of promises and returns a promise that
// will deliver an array of results only if every promise is kept.

            var remaining = array.length, results = [], vow = VOW.make();

            if (remaining === 0) {
                vow.keep(results);
            } else {
                array.forEach(function (promise, i) {
                    promise.when(function (value) {
                        results[i] = value;
                        remaining -= 1;
                        if (remaining === 0) {
                            vow.keep(results);
                        }
                    }, function (reason) {
                        remaining = NaN;
                        vow.break(reason);
                    });
                });
            }
            return vow.promise;
        },
        first: function every(array) {

// The first function takes an array of promises and returns a promise to
// deliver the first observed result, or a broken promise if none are kept.

            var found = false, remaining = array.length, vow = VOW.make();

            function check() {
                remaining -= 1;
                if (remaining === 0 && !found) {
                    vow.break();
                }
            }

            if (remaining === 0) {
                vow.break('first');
            } else {
                array.forEach(function (promise) {
                    promise.when(function (value) {
                        if (!found) {
                            found = true;
                            vow.keep(value);
                        }
                        check();
                    }, check);
                });
            }
            return vow.promise;
        },
        any: function any(array) {

// The any function takes an array of promises and returns a promise that
// will deliver a possibly sparse array of results of any kept promises.
// The result will contain an undefined cell for each broken promise.

            var remaining = array.length, results = [], vow = VOW.make();

            function check() {
                remaining -= 1;
                if (remaining === 0) {
                    vow.keep(results);
                }
            }

            if (remaining === 0) {
                vow.keep(results);
            } else {
                array.forEach(function (promise, i) {
                    promise.when(function (value) {
                        results[i] = value;
                        check();
                    }, check);
                });
            }
            return vow.promise;
        },
        kept: function (value) {

// Returns a new kept promise.

            var vow = VOW.make();
            vow.keep(value);
            return vow.promise;
        },
        broken: function (reason) {

// Returns a new broken promise/

            var vow = VOW.make();
            vow.break(reason);
            return vow.promise;
        }
    };
}());
