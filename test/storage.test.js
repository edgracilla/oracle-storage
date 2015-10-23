/*
 * Just a sample code to test the storage plugin.
 * Kindly write your own unit tests for your own plugin.
 */
'use strict';

var cp     = require('child_process'),
	assert = require('assert'),
	storage;

describe('Storage', function () {
	this.slow(5000);

	after('terminate child process', function () {
		storage.kill('SIGKILL');
	});

	describe('#spawn', function () {
		it('should spawn a child process', function () {
			assert.ok(storage = cp.fork(process.cwd()), 'Child process not spawned.');
		});
	});

	describe('#handShake', function () {
		it('should notify the parent process when ready within 5 seconds', function (done) {
			this.timeout(5000);

			storage.on('message', function (message) {
				if (message.type === 'ready')
					done();
			});

			storage.send({
				type: 'ready',
				data: {
					options :   {
						connection : 'reekoh-oracle.cg1corueo9zh.us-east-1.rds.amazonaws.com:1521/ORCL',
						user 	   : 'reekoh',
						password   : 'rozzwalla',
						schema     : 'REEKOH',
						fields     : JSON.stringify({ string_type: {source_field:'name', data_type: 'String'}}),
						table      : 'TEST_TABLE'
					}
				}
			});
		});
	});

	describe('#data', function () {
		it('should process the data', function () {
			storage.send({
				type: 'data',
				data: {
					name: 'rozz'
				}
			});
		});
	});
});