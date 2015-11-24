'use strict';

var platform      = require('./platform'),
	async         = require('async'),
	oracledb	  = require('oracledb'),
	isPlainObject = require('lodash.isplainobject'),
	tableName, parseFields, conn;


oracledb.autoCommit = true;

/*
 * Listen for the ready event.
 */
platform.once('ready', function (options) {
	var isEmpty = require('lodash.isempty');
	//try catch to capture parsing error in JSON.parse
	try {
		parseFields = JSON.parse(options.fields);
	}
	catch (ex) {
		platform.handleException(new Error('Invalid option parameter: fields. Must be a valid JSON String.'));

		return setTimeout(function () {
			process.exit(1);
		}, 2000);
	}

	async.forEachOf(parseFields, function(field, key, callback) {
		if (isEmpty(field.source_field))
			callback(new Error('Source field is missing for ' + key + ' Oracle MySQL Plugin'));
		else if (field.data_type && (field.data_type !== 'String' &&
			field.data_type !== 'Integer' && field.data_type !== 'Float' &&
			field.data_type !== 'Boolean' && field.data_type !== 'Timestamp' &&
			field.data_type !== 'Date')) {

			callback(new Error('Invalid Data Type for ' + key + ' allowed data types are (String, Integer, Float, Boolean, DateTime) in Oracle Plugin'));
		}
		else
			callback();
	}, function (error) {
		if (error) {
			console.error('Error parsing JSON field configuration for Oracle.', error);
			return platform.handleException(error);
		}

		tableName = options.table;

		if (options.schema)
			tableName = options.schema + '.' + tableName;

		var config = {
			user: options.user,
			password: options.password,
			connectString: options.connection
		};

		oracledb.getConnection(config,
			function(err, connection) {
				if (err) {
					console.error('Error connecting to Oracle.', err);
					platform.handleException(err);
				} else {
					conn = connection;
					platform.log('Connected to Oracle.');
					platform.notifyReady(); // Need to notify parent process that initialization of this plugin is done.
				}
			}
		);

	});

});

/*
 * Listen for the data event.
 */
platform.on('data', function (data) {

	var columnList, valueList, first = true;

	async.forEachOf(parseFields, function(field, key, callback) {

		var datum = data[field.source_field],
			processedDatum;

		if (datum !== undefined && datum !== null) {
			if (field.data_type) {
				try {
					if (field.data_type === 'String') {

						if (isPlainObject(datum))
							processedDatum = '\'' + JSON.stringify(datum) + '\'';
						else
							processedDatum = '\'' + String(datum) + '\'';


					} else if (field.data_type === 'Integer')  {

						var intData = parseInt(datum);

						if (isNaN(intData))
							processedDatum = datum; //store original value
						else
							processedDatum = intData;

					} else if (field.data_type === 'Float')  {

						var floatData = parseFloat(datum);

						if (isNaN(floatData))
							processedDatum = datum; //store original value
						else
							processedDatum = floatData;

					} else if (field.data_type === 'Boolean') {

						var type = typeof datum;

						if ((type === 'string' && datum.toLocaleLowerCase() === 'true') ||
							(type === 'boolean' && datum === true )) {
							processedDatum = 1;
						} else if ((type === 'string' && datum.toLocaleLowerCase() === 'false') ||
							(type === 'boolean' && datum === false )) {
							processedDatum = 0;
						} else {
							processedDatum = datum;
						}
					} else if (field.data_type === 'Timestamp') {

						var ts_format = 'yyyy-mm-dd hh24:mi:ss.ff';

						if (field.format !== undefined)
							ts_format = field.format;

						processedDatum = 'TO_TIMESTAMP(\'' + datum + '\', \'' + ts_format + '\' )';

					} else if (field.data_type === 'Date') {

						var dt_format = 'yyyy-mm-dd';

						if (field.format !== undefined)
							dt_format = field.format;

						processedDatum = 'TO_DATE(\'' + datum + '\', \'' + dt_format + '\' )';

					}
				} catch (e) {
					if (typeof datum === 'number')
						processedDatum = datum;
					else if (isPlainObject(datum))
						processedDatum = JSON.stringify(datum);
					else
						processedDatum = '\'' + datum + '\'';
				}

			} else {
				if (typeof datum === 'number')
					processedDatum = datum;
				else if (isPlainObject(datum))
					processedDatum = '\'' + JSON.stringify(datum) + '\'';
				else
					processedDatum = '\'' + datum + '\'';
			}

		} else {
			processedDatum = null;
		}

		if (!first) {
			valueList  = valueList  + ',' + processedDatum;
			columnList = columnList  + ',' + key;
		} else {
			first      = false;
			valueList  = processedDatum;
			columnList = key;
		}
		callback();
	}, function () {
		conn.execute('insert into ' + tableName + ' (' + columnList +  ') values (' + valueList + ')', function (insErr, result) {
			if (insErr) {
				console.error('Error committing transaction into Oracle.', insErr);
				platform.handleException(insErr);
			}
		});
	});



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
		conn.end(function (error) {
			if (error) platform.handleException(error);
			platform.notifyClose();
			d.exit();
		});
	});
});