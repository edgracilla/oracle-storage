'use strict';

var cp     = require('child_process'),
	assert = require('assert'),
	should = require('should'),
	moment = require('moment'),
	storage;

const CONNECTION = 'reekoh-oracle.cg1corueo9zh.us-east-1.rds.amazonaws.com:1521/ORCL',
	  USER       = 'reekoh',
	  PASSWORD   = 'rozzwalla',
	  SCHEMA     = 'REEKOH',
	  TABLE      = 'REEKOH_TABLE',
	  _ID        = new Date().getTime();

var record = {
	id: _ID,
	co2: '11%',
	temp: 23,
	quality: 11.25,
	reading_time: '2015-11-27 11:04:13.539',
	metadata: '{"metadata_json": "reekoh metadata json"}',
	random_data: 'abcdefg',
	is_normal: true
};


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
					options: {
						connection: CONNECTION,
						user: USER,
						password: PASSWORD,
						schema: SCHEMA,
						table: TABLE,
						field_mapping: JSON.stringify({
							id: {source_field: 'id', data_type: 'Integer'},
							co2_field: {source_field: 'co2', data_type: 'String'},
							temp_field: {source_field: 'temp', data_type: 'Integer'},
							quality_field: {source_field: 'quality', data_type: 'Float'},
							reading_time_field: {
								source_field: 'reading_time',
								data_type: 'Timestamp',
								format: 'yyyy-mm-dd hh24:mi:ss.ff'
							},
							metadata_field: {source_field: 'metadata', data_type: 'String'},
							random_data_field: {source_field: 'random_data'},
							is_normal_field: {source_field: 'is_normal', data_type: 'Boolean'}
						})
					}
				}
			});
		});
	});

	describe('#data', function () {
		it('should process the data', function (done) {
			storage.send({
				type: 'data',
				data: record
			}, done);
		});
	});

	describe('#data', function () {
		it('should have inserted the data', function (done) {
			this.timeout(10000);

			var oracledb = require('oracledb');

			oracledb.outFormat = oracledb.OBJECT;

			var config = {
				user: USER,
				password: PASSWORD,
				connectString: CONNECTION
			};

			oracledb.getConnection(config, function (err, connection) {
				connection.execute('SELECT * FROM ' + TABLE + ' WHERE id = ' + _ID, [], {}, function (insErr, result) {
					should.exist(result.rows[0]);
					var resp = result.rows[0];

					//cleanup for JSON stored string
					var cleanMetadata = resp.METADATA_FIELD.replace(/\\"/g, '"');
					var str = JSON.stringify(record.metadata);
					var str2 = JSON.stringify(cleanMetadata);

					should.equal(record.co2, resp.CO2_FIELD, 'Data validation failed. Field: co2');
					should.equal(record.temp, resp.TEMP_FIELD, 'Data validation failed. Field: temp');
					should.equal(record.quality, resp.QUALITY_FIELD, 'Data validation failed. Field: quality');
					should.equal(record.random_data, resp.RANDOM_DATA_FIELD, 'Data validation failed. Field: random_data');
					should.equal(moment(record.reading_time).format('YYYY-MM-DD HH:mm:ss'),
						moment(resp.READING_TIME_FIELD).format('YYYY-MM-DD HH:mm:ss'),
						'Data validation failed. Field: reading_time');
					should.equal(str, str2, 'Data validation failed. Field: metadata');

					done();
				});
			});
		});
	});
});