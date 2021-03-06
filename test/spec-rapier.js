var assert = require('assert'),
	serverConfig = require('./server/config'),
	server = require('./server/server'),
	rapier = require('../lib/rapier');

describe('rapier integration test', function () {
	var testHost, apiDecl, api;

	before(function () {
		server = server.listen(serverConfig.port);
		testHost = 'http://' + serverConfig.host + ':' + serverConfig.port + '/';
	});

	after(function (done) {
		server.close(done);
	});

	beforeEach(function () {
		apiDecl = {
			'.': {
				cascade: {
					rootLevel: true
				},
				prefilter: function (options, result) {
					assert.ok(options.cascade.rootLevel);
					assert.ok(options.cascade.layerLevel);
					assert.ok(options.cascade.handlerLevel);
					assert.equal(this, api);
				},
				processResult: function (options, result) {
					assert.ok(result.data);
					assert.ok(result.request);
					assert.equal(this, api);

					// это не правильно? 
					// хотя может и вариант, т.к это простой способ
					// вынесте из объекта под объект
					// return result;
				},
			},

			'.layer': {
				cascade: {
					layerLevel: true
				}
			},

			'.layer.handlerOne': {
				url: testHost + 'layer/handlerOne',
				cascade: {
					handlerLevel: true
				}
			},

			'.layer.handlerTwo': testHost + 'layer/handlerTwo',

			'.layer.handlerThree': function (options, result) {
				result.data = { functionExecuted: true };
				result.request = {};
			},

			'.layer.handlerFour' : {
				url: testHost + 'layer/handlerFout/:id'
			},

			'.layer.handlerFive' : {
				type: 'POST',
				url: testHost + 'layer/handlerFive/:id',
			}
		};

		api = rapier(apiDecl);
	});

	it('should export correct strucutre', function () {
		assert.ok(api);
		assert.ok(api.layer);
		assert.ok(api.layer.handlerOne);
	});

	describe('API handler', function () {
		var callbackExecuted;
	
		function callback(result) {
			assert.equal(this, api);
			callbackExecuted = true;
		}

		beforeEach(function () {
			callbackExecuted = false;
		});


		it('should be a function', function () {
			assert.equal(typeof api.layer.handlerOne, 'function');
		});

		it('should return promise', function () {
			var promise = api.layer.handlerOne();
			assert.equal(typeof promise.then, 'function');

			return promise;
		});

		it('should create request', function () {
			return api.layer.handlerOne(callback)
				.then(function (result) {
					assert.equal(callbackExecuted, true);
					assert.equal(result.status, 200);
				});
		});

		it('should fail if executed with wrong params', function () {
			return api.layer.handlerOne({ code: 404 }, callback)
				.fail(function (result) {
					assert.equal(callbackExecuted, true);
					// не сохранена структура result при then и fail
					assert.equal(result.status, 404);
				});
		});

		it('should exec node with string passed as options', function () {
			return api.layer.handlerTwo({}, {cascade:{handlerLevel: true}})
				.then(function (result) {
					assert.equal(result.data.path, '/layer/handlerTwo');
				});
		});

		it('should exec node with function passed as options', function () {
			return api.layer.handlerThree({}, {cascade:{handlerLevel: true}})
				.then(function (result) {
					assert.ok(result.data.functionExecuted);
				});
		});

		it('should work with url-template plugin', function () {
			return api.layer.handlerFour({id:100500, additional: true}, {cascade:{handlerLevel: true}})
				.then(function (result) {
					assert.equal(result.data.path, '/layer/handlerFout/100500');
					assert.ok(result.data.query.additional);
				});
		});

		it('should work with url-template plugin and post method', function () {
			return api.layer.handlerFive({id: 1, additional: true}, {cascade:{handlerLevel: true}})
				.then(function (result) {
					assert.equal(result.data.method, 'POST');
					assert.ok(result.data.body.additional);
					assert.ok(!result.data.body.id);
				});
		});

	});

	describe('Setters & Getters', function () {

		it('can set & get options for whole api', function () {
			api._set('data', { someOption: 'someValue' });
			assert.equal(api._get('data').someOption, 'someValue');

			return api.layer.handlerOne().then(function (result) {
				assert.equal(result.data.query.someOption, 'someValue');
			});
		});

		it('can set & get options for specified node', function () {
			api._set('.layer.handlerOne','data', { specified: true });
			assert.equal(api._get('.layer.handlerOne', 'data').specified, true);

			return api.layer.handlerOne().then(function (result) {
				assert.equal(result.data.query.specified, 'true');
			});
		});

	});

	describe('Plugin system', function () {
		var plugin, pluginStageExecuted, pluginExtendExecuted,
			pluginAsFunction;

		beforeEach(function () {
			pluginStageExecuted = false;
			pluginExtendExecuted = false;
			pluginAsObject = {
				name: 'Some plugin name',
				stages: {
					_prefilter: function (options, result, deferred) {
						assert.equal(options.cascade, 'some uniq string');
						pluginStageExecuted = true;
					}
				},
				extendRules: {
					cascade: function (optionsChainItem) {
						pluginExtendExecuted = true;
						assert.equal(arguments.length, 3);
						return 'some uniq string';
					}
				}
			};

			pluginAsFunction = function () {
				return pluginAsObject;
			};

			delete apiDecl['.']['prefilter'];
			rapier.pluginReset();
		});

		describe('#plugin()', function () {
			it('should set up new stage & extend rule', function () {
				rapier.plugin(pluginAsObject);
				api = rapier(apiDecl);

				return api.layer.handlerOne().then(function (result) {
					assert.ok(pluginStageExecuted);
					assert.ok(pluginExtendExecuted);
				});
			});

			it('should accept function as arguments', function () {
				rapier.plugin(pluginAsFunction);
				api = rapier(apiDecl);

				return api.layer.handlerOne().then(function (result) {
					assert.ok(pluginStageExecuted);
					assert.ok(pluginExtendExecuted);
				});
			});

			it('should set up several stages', function () {
				pluginAsObject.stages._processResult = function (options, result, defferred) {
					result.secondStageInited = true;
				};

				rapier.plugin(pluginAsObject);
				api = rapier(apiDecl);

				return api.layer.handlerOne().then(function (result) {
					assert.ok(result.secondStageInited);
					assert.ok(pluginStageExecuted);
					assert.ok(pluginExtendExecuted);
				});

			});

		});
	});


});