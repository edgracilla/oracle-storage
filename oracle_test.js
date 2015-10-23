var oracledb = require('oracledb'),
    _   = require('lodash'),
    isJSON      = require('is-json');

oracledb.autoCommit = true;

var options = {};

//validate config fields;

options.connection = 'reekoh-oracle.cg1corueo9zh.us-east-1.rds.amazonaws.com:1521/ORCL';
options.user = 'reekoh';
options.password = 'rozzwalla';
options.fields = '{ "string_type": {"source_field":"name", "data_type": "String"}, "int_type": {"source_field":"age" }, "date_type": {"source_field":"dtm", "data_type":"Date"}, "timestamp_type": {"source_field":"ts", "data_type":"Timestamp"}}';
options.schema = 'REEKOH';
options.table = 'TEST_TABLE';


var config = {
    user: options.user,
    password: options.password,
    connectString: options.connection
};

var parseFields, tableName, conn;

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
    //console.error('Error parsing JSON field configuration for MySQL.', e);
    //platform.handleException(e);
    console.log(e);
    return;
}

tableName = options.table;

if (options.schema)
    tableName = options.schema + '.' + tableName;

var data = {name: 'rozzwalla', age: 1, dtm: '2012-03-22', ts: '2012-05-25 16:01:02'};

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
                        format = field.format;

                    processedDatum = 'TO_TIMESTAMP(\'' + datum + '\', \'' + ts_format + '\' )';

                } else if (field.data_type === 'Date') {

                    var dt_format = 'yyyy-mm-dd';

                    if (field.format !== undefined)
                        format = field.format;

                    processedDatum = 'TO_DATE(\'' + datum + '\', \'' + dt_format + '\' )';

                }
            } catch (e) {
                //console.error('Data conversion error in MySQL.', e);
                //platform.handleException(e);
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


console.log(valueList);
console.log(columnList);

oracledb.getConnection(config,
    function(err, connection) {
        if (err)
            return;

        conn = connection;
        exe();

    }
);

function exe() {
    conn.execute('insert into ' + tableName + ' (' + columnList +  ') values (' + valueList + ')', function (err, result) {
        console.log(err);
        console.log(result);

    })
}