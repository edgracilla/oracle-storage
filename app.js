'use strict';

var async         = require('async'),
	isNil         = require('lodash.isnil'),
	moment        = require('moment'),
	isEmpty       = require('lodash.isempty'),
	isArray       = require('lodash.isarray'),
	oracledb      = require('oracledb'),
	isNumber      = require('lodash.isnumber'),
	isString      = require('lodash.isstring'),
	platform      = require('./platform'),
	isBoolean     = require('lodash.isboolean'),
	isPlainObject = require('lodash.isplainobject'),
	pool, tableName, fieldMapping;

let insertData = function (data, callback) {
	let query = `insert into ${tableName} (${data.columns.join(', ')}) values (${data.values.join(', ')})`;

	console.log(query);
	console.log(data.data);

	pool.getConnection((connectionError, connection) => {
		if (connectionError) return callback(connectionError);

		connection.execute(query, data.data, {autoCommit: true}, (insertError) => {
			connection.release(function () {
				if (!insertError) {
					platform.log(JSON.stringify({
						title: 'Record Successfully inserted to Oracle Database.',
						data: data
					}));
				}

				callback(insertError);
			});
		});
	});
};

let processData = function (data, callback) {
	let keyCount      = 0,
		processedData = {
			columns: [],
			values: [],
			data: {}
		};

	async.forEachOf(fieldMapping, (field, key, done) => {
		keyCount++;

		processedData.columns.push(`"${key}"`);
		processedData.values.push(`:val${keyCount}`);

		let datum = data[field.source_field],
			processedDatum;

		if (!isNil(datum) && !isEmpty(field.data_type)) {
			try {
				if (field.data_type === 'String') {
					if (isPlainObject(datum))
						processedDatum = JSON.stringify(datum);
					else
						processedDatum = `${datum}`;
				}
				else if (field.data_type === 'Integer') {
					if (isNumber(datum))
						processedDatum = datum;
					else {
						let intData = parseInt(datum);

						if (isNaN(intData))
							processedDatum = datum; //store original value
						else
							processedDatum = intData;
					}
				}
				else if (field.data_type === 'Float') {
					if (isNumber(datum))
						processedDatum = datum;
					else {
						let floatData = parseFloat(datum);

						if (isNaN(floatData))
							processedDatum = datum; //store original value
						else
							processedDatum = floatData;
					}
				}
				else if (field.data_type === 'Boolean') {
					if ((isString(datum) && datum.toLowerCase() === 'true') || (isNumber(datum) && datum === 1))
						processedDatum = 1;
					else if ((isString(datum) && datum.toLowerCase() === 'false') || (isNumber(datum) && datum === 0))
						processedDatum = 0;
					else
						processedDatum = (datum) ? 1 : 0;
				}
				else if (field.data_type === 'Date' || field.data_type === 'Timestamp') {
					if (moment(datum).isValid() && isEmpty(field.format))
						processedDatum = moment(datum).toDate();
					else if (moment(datum).isValid() && !isEmpty(field.format))
						processedDatum = moment(datum).format(field.format).toDate();
					else
						processedDatum = datum;

					console.log(processedDatum);
				}
			}
			catch (e) {
				if (isPlainObject(datum))
					processedDatum = JSON.stringify(datum);
				else
					processedDatum = datum;
			}
		}
		else if (!isNil(datum) && isEmpty(field.data_type)) {
			if (isPlainObject(datum))
				processedDatum = JSON.stringify(datum);
			else
				processedDatum = `${datum}`;
		}
		else
			processedDatum = null;

		processedData.data[`val${keyCount}`] = processedDatum;

		done();
	}, () => {
		callback(null, processedData);
	});
};

platform.on('data', function (data) {
	if (isPlainObject(data)) {
		processData(data, (error, processedData) => {
			insertData(processedData, (error) => {
				if (error) {
					console.error(error);
					platform.handleException(error);
				}
			});
		});
	}
	else if (isArray(data)) {
		async.each(data, function (datum) {
			processData(datum, (error, processedData) => {
				insertData(processedData, (error) => {
					if (error) platform.handleException(error);
				});
			});
		});
	}
	else
		platform.handleException(new Error(`Invalid data received. Data must be a valid Array/JSON Object or a collection of objects. Data: ${data}`));
});

/*
 * Event to listen to in order to gracefully release all resources bound to this service.
 */
platform.on('close', function () {
	var domain = require('domain');
	var d = domain.create();

	d.once('error', function (error) {
		console.error(error);
		platform.handleException(error);
		platform.notifyClose();
		d.exit();
	});

	d.run(function () {
		pool.terminate(function (error) {
			if (error) platform.handleException(error);
			platform.notifyClose();
			d.exit();
		});
	});
});

/*
 * Listen for the ready event.
 */
platform.once('ready', function (options) {
	if (options.schema)
		tableName = `"${options.schema}"."${options.table}"`;
	else
		tableName = `"${options.table}"`;

	async.waterfall([
		async.constant(options.field_mapping || '{}'),
		async.asyncify(JSON.parse),
		(obj, done) => {
			fieldMapping = obj;
			done();
		}
	], (parseError) => {
		if (parseError) {
			platform.handleException(new Error('Invalid field mapping. Must be a valid JSON String.'));

			return setTimeout(function () {
				process.exit(1);
			}, 2000);
		}

		let isEmpty = require('lodash.isempty');

		async.forEachOf(fieldMapping, (field, key, done) => {
			if (isEmpty(field.source_field))
				done(new Error('Source field is missing for ' + key + ' in field mapping.'));
			else if (field.data_type && (field.data_type !== 'String' &&
				field.data_type !== 'Integer' && field.data_type !== 'Float' &&
				field.data_type !== 'Boolean' && field.data_type !== 'Timestamp' &&
				field.data_type !== 'Date')) {

				done(new Error('Invalid Data Type for ' + key + ' in field mapping. Allowed data types are String, Integer, Float, Boolean, Timestamp and Date.'));
			}
			else
				done();
		}, (fieldMapError) => {
			if (fieldMapError) {
				console.error('Error parsing field mapping.', fieldMapError);
				platform.handleException(fieldMapError);

				return setTimeout(() => {
					process.exit(1);
				}, 2000);
			}

			oracledb.createPool({
				user: options.user,
				password: options.password,
				connectString: options.connection
			}, (connectionError, connectionPool) => {
				if (connectionError) {
					console.error('Error connecting to Oracle Database Server.', connectionError);
					platform.handleException(connectionError);

					return setTimeout(() => {
						process.exit(1);
					}, 2000);
				}

				pool = connectionPool;

				platform.log('Connected to Oracle Database Server.');
				platform.notifyReady();
			});
		});
	});
});