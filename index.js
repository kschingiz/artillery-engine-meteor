const async = require('async');
const debug = require('debug')('meteor');
const DDPClient = require('ddp');
const _ = require('lodash')
const helpers = require('artillery/core/lib/engine_util');

module.exports = MeteorEngine;

function MeteorEngine (script){
  this.config = script.config;
  this.helpers = helpers;
}

MeteorEngine.prototype.createScenario = function(scenarioSpec, ee) {
  var self = this;

  let tasks = _.map(scenarioSpec.flow, function(rs) {
    if(rs.think){
      return helpers.createThink(rs, _.get(self.config, 'defaults.think', {}))
    }
    return self.step(rs, ee);
  });

  return self.compile(tasks, scenarioSpec.flow, ee);
}

MeteorEngine.prototype.step = function(requestSpec, ee) {
  let self = this;

  if (requestSpec.loop) {
    let steps = _.map(requestSpec.loop, function(rs) {
      return self.step(rs, ee);
    });

    return helpers.createLoopWithCount(
      requestSpec.count || -1,
      steps,
      {
        loopValue: requestSpec.loopValue || '$loopCount',
        overValues: requestSpec.over,
        whileTrue: self.config.processor ?
          self.config.processor[requestSpec.whileTrue] : undefined
      });
  }

  if (requestSpec.think) {
    return helpers.createThink(requestSpec, _.get(self.config, 'defaults.think', {}));
  }

  if (requestSpec.function) {
    return function(context, callback) {
      let processFunc = self.config.processor[requestSpec.function];
      if (processFunc) {
        processFunc(context, ee, function () {
          return callback(null, context);
        });
      }
    }
  }

  let call = function(context, callback) {
    ee.emit('request');
    let startedAt = process.hrtime();

    const method = requestSpec.call.name;
    const payload = helpers.template(requestSpec.call.payload, context);

    debug('Meteor call: %s', method, payload);

    context.ddpclient.call(method, payload, (err, result) => {
      if (err) {
        debug(err);
        ee.emit('error', err);
      } else {
        let endedAt = process.hrtime(startedAt);
        let delta = (endedAt[0] * 1e9) + endedAt[1];
        ee.emit('response', delta, 0, context._uid);
      }
      return callback(err, context);
    });
  };

  if(requestSpec.call){
    return call;
  }

  let subscribe = function(context, callback) {
    ee.emit('request');
    let startedAt = process.hrtime();

    const pubName = requestSpec.subscribe.name;
    const payload = helpers.template(requestSpec.subscribe.payload, context);

    debug('Meteor subscribe: %s', pubName, payload);

    context.ddpclient.subscribe(pubName, payload, (err) => {             
      if (err) {
        debug(err);
        ee.emit('error', err);
      } else {
        let endedAt = process.hrtime(startedAt);
        let delta = (endedAt[0] * 1e9) + endedAt[1];
        ee.emit('response', delta, 0, context._uid);
      }
      return callback(err, context);
    });
  }

  if(requestSpec.subscribe){
    return subscribe
  }

  let login = function(context, callback) {
    ee.emit('request');
    let startedAt = process.hrtime();

    const payload = helpers.template(requestSpec.login, context);

    debug('Meteor login: %s', payload);

    const userProps = {};

    if(payload.username){
      userProps.username = payload.username;
    } else if(payload.email) {
      userProps.email = payload.email;
    }

    context.ddpclient.call("login", [{
      user: userProps,
      password: payload.password
    }], (err) => {             
      if (err) {
        debug(err);
        ee.emit('error', err);
      } else {
        let endedAt = process.hrtime(startedAt);
        let delta = (endedAt[0] * 1e9) + endedAt[1];
        ee.emit('response', delta, 0, context._uid);
      }
      return callback(err, context);
    });
  }

  if(requestSpec.login){
    return login;
  }
}

MeteorEngine.prototype.compile = function(tasks, scenarioSpec, ee) {
  let config = this.config;

  return function scenario(initialContext, callback) {
    function zero(callback) {
      ee.emit('started');

      const ddpclient = new DDPClient({
        maintainCollections: false,
        ddpVersion : '1',
        url: config.target
      })
      
      ddpclient.connect((error) => {
        if(error) {
          debug(error);
          ee.emit('error', error.message || error.code);
          return callback(error, {});
        } else {
          initialContext.ddpclient = ddpclient;
          return callback(null, initialContext)
        }
      });
    }

    initialContext._successCount = 0;

    let steps = _.flatten([
      zero,
      tasks
    ]);

    async.waterfall(
      steps,
      function scenarioWaterfallCb(err, context) {
        if (err) {
          debug(err);
        }

        if (context && context.ddpclient) {
          context.ddpclient.close();
        }

        return callback(err, context);
      });
  }
}