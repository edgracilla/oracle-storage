'use strict';

var platform    = require('./platform'),
	oracledb	= require('oracledb'),
	_			= require('lodash'),
	isJSON      = require('is-json'),
	tableName, parseFields, conn;


oracledb.autoCommit = true;

/*
 * Listen for the ready event.
 */
platform.once('ready', function (options) {

	//try catch to capture parsing error in JSON.parse
	try {
		parseFields = JSON.parse(options.fields);

		_.forEach(parseFields, function(field, key) {
			if (field.source_field === undefined || field.source_field === null) {
				throw( new Error('Source field is missing for ' + key + ' in Oracle Plugin'));
			} else if (field.data_type  && (field.data_type !== 'String' && field.data_type !== 'Integer' &&
				field.data_type !== 'Float'  && field.data_type !== 'Boolean' &&
				field.data_type !== 'Date' && field.data_type !== 'Timestamp')) {
				throw(new Error('Invalid Data Type for ' + key + ' allowed data types are (String, Integer, Float, Boolean, Date) in Oracle Plugin'));
			}
		});

	} catch (e) {
		console.error('Error parsing JSON field configuration for Oracle Plugin.', e);
		platform.handleException(e);
		return;
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

/*
 * Listen for the data event.
 */
platform.on('data', function (data) {

	if (isJSON(data, true)) {
		var columnList, valueList, first = true;

		_.forEach(parseFields, function(field, key) {

			var datum = data[field.source_field],
				processedDatum;

			if (datum !== undefined && datum !== null) {
				if (field.data_type) {
					try {
						if (field.data_type === 'String') {

							if (isJSON(datum))
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
						else if (isJSON(datum))
							processedDatum = JSON.stringify(datum);
						else
							processedDatum = '\'' + datum + '\'';
					}

				} else {
					if (typeof datum === 'number')
						processedDatum = datum;
					else if (isJSON(datum))
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

		});

		conn.execute('insert into ' + tableName + ' (' + columnList +  ') values (' + valueList + ')', function (insErr, result) {
				if (insErr) {
					console.error('Error committing transaction into Oracle.', insErr);
					platform.handleException(insErr);
				}
		});



	} else {

		console.error('Invalid Data not in JSON Format for Oracle Plugin.', data);
		platform.log('Invalid Data not in JSON Format for Oracle Plugin.', data);

	}


});