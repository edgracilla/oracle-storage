'use strict'

const reekoh = require('demo-reekoh-node')
const _plugin = new reekoh.plugins.Storage()

const async = require('async')
const isNil = require('lodash.isnil')
const moment = require('moment')
const isEmpty = require('lodash.isempty')
const isArray = Array.isArray
const oracledb = require('oracledb')
const isNumber = require('lodash.isnumber')
const isString = require('lodash.isstring')
const isPlainObject = require('lodash.isplainobject')

let pool = null
let tableName = null
let fieldMapping = null

let insertData = (data, callback) => {
  let query = `insert into ${tableName} (${data.columns.join(', ')}) values (${data.values.join(', ')})`

  pool.getConnection((connectionError, connection) => {
    if (connectionError) return callback(connectionError)

    connection.execute(query, data.data, {autoCommit: true}, (insertError) => {
      connection.release(() => {
        callback(insertError)
      })
    })
  })
}

let processData = (data, callback) => {
  let keyCount = 0
  let processedData = {
    columns: [],
    values: [],
    data: {}
  }

  async.forEachOf(fieldMapping, (field, key, done) => {
    keyCount++

    processedData.columns.push(`"${key}"`)
    processedData.values.push(`:val${keyCount}`)

    let datum = data[field.source_field]
    let processedDatum

    if (!isNil(datum) && !isEmpty(field.data_type)) {
      try {
        if (field.data_type === 'String') {
          if (isPlainObject(datum)) {
            processedDatum = JSON.stringify(datum)
          } else {
            processedDatum = `${datum}`
          }
        } else if (field.data_type === 'Integer') {
          if (isNumber(datum)) {
            processedDatum = datum
          } else {
            let intData = parseInt(datum)

            if (isNaN(intData)) {
              processedDatum = datum
            } else { // store original value
              processedDatum = intData
            }
          }
        } else if (field.data_type === 'Float') {
          if (isNumber(datum)) {
            processedDatum = datum
          } else {
            let floatData = parseFloat(datum)

            if (isNaN(floatData)) {
              processedDatum = datum
            } else {
              processedDatum = floatData
            }
          }
        } else if (field.data_type === 'Boolean') {
          if ((isString(datum) && datum.toLowerCase() === 'true') || (isNumber(datum) && datum === 1)) {
            processedDatum = 1
          } else if ((isString(datum) && datum.toLowerCase() === 'false') || (isNumber(datum) && datum === 0)) {
            processedDatum = 0
          } else {
            processedDatum = (datum) ? 1 : 0
          }
        } else if (field.data_type === 'Date' || field.data_type === 'Timestamp') {
          if (isEmpty(field.format) && moment(datum).isValid()) {
            processedDatum = moment(datum).toDate()
          } else if (!isEmpty(field.format) && moment(datum, field.format).isValid()) {
            processedDatum = moment(datum, field.format).toDate()
          } else if (!isEmpty(field.format) && moment(datum).isValid()) {
            processedDatum = moment(datum).toDate()
          } else { processedDatum = datum }
        }
      } catch (e) {
        if (isPlainObject(datum)) { processedDatum = JSON.stringify(datum) } else {
          processedDatum = datum
        }
      }
    } else if (!isNil(datum) && isEmpty(field.data_type)) {
      if (isPlainObject(datum)) {
        processedDatum = JSON.stringify(datum)
      } else { processedDatum = `${datum}` }
    } else {
      processedDatum = null
    }

    processedData.data[`val${keyCount}`] = processedDatum

    done()
  }, () => {
    callback(null, processedData)
  })
}

_plugin.on('data', (data) => {
  if (isPlainObject(data)) {
    processData(data, (error, processedData) => {
      insertData(processedData, (error) => {
        if (!error) {
          process.send({ type: 'processed' })
          _plugin.log(JSON.stringify({
            title: 'Record Successfully inserted to Oracle Database.',
            data: data
          }))
        } else {
          _plugin.logException(error)
        }
      })
    })
  } else if (isArray(data)) {
    async.each(data, (datum) => {
      processData(datum, (error, processedData) => {
        insertData(processedData, (error) => {
          if (!error) {
            process.send({ type: 'processed' })
            _plugin.log(JSON.stringify({
              title: 'Record Successfully inserted to Oracle Database.',
              data: datum
            }))
          } else {
            _plugin.logException(error)
          }
        })
      })
    })
  } else {
    _plugin.logException(new Error(`Invalid data received. Data must be a valid Array/JSON Object or a collection of objects. Data: ${data}`))
  }
})

_plugin.once('ready', () => {
  let options = {
    connection: process.env.ORACLE_CONNECTION,
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    schema: process.env.ORACLE_SCHEMA,
    table: process.env.ORACLE_TABLE,

    field_mapping: JSON.stringify({
      ID: {source_field: 'id', data_type: 'Integer'},
      CO2_FIELD: {source_field: 'co2', data_type: 'String'},
      TEMP_FIELD: {source_field: 'temp', data_type: 'Integer'},
      QUALITY_FIELD: {source_field: 'quality', data_type: 'Float'},
      READING_TIME_FIELD: {
        source_field: 'reading_time',
        data_type: 'Timestamp'
      },
      METADATA_FIELD: {source_field: 'metadata', data_type: 'String'},
      RANDOM_DATA_FIELD: {source_field: 'random_data'},
      IS_NORMAL_FIELD: {source_field: 'is_normal', data_type: 'Boolean'}
    })
  }

  if (options.schema) {
    tableName = `"${options.schema}"."${options.table}"`
  } else {
    tableName = `"${options.table}"`
  }

  async.waterfall([
    async.constant(options.field_mapping || '{}'),
    async.asyncify(JSON.parse),
    (obj, done) => {
      fieldMapping = obj
      done()
    }
  ], (parseError) => {
    if (parseError) {
      _plugin.logException(new Error('Invalid field mapping. Must be a valid JSON String.'))

      return setTimeout(() => {
        process.exit(1)
      }, 5000)
    }

    let isEmpty = require('lodash.isempty')

    async.forEachOf(fieldMapping, (field, key, done) => {
      if (isEmpty(field.source_field)) {
        done(new Error('Source field is missing for ' + key + ' in field mapping.'))
      } else if (field.data_type && (field.data_type !== 'String' &&
        field.data_type !== 'Integer' && field.data_type !== 'Float' &&
        field.data_type !== 'Boolean' && field.data_type !== 'Timestamp' &&
        field.data_type !== 'Date')) {
        done(new Error('Invalid Data Type for ' + key + ' in field mapping. Allowed data types are String, Integer, Float, Boolean, Timestamp and Date.'))
      } else {
        done()
      }
    }, (fieldMapError) => {
      if (fieldMapError) {
        console.error('Error parsing field mapping.', fieldMapError)
        _plugin.logException(fieldMapError)

        return setTimeout(() => {
          process.exit(1)
        }, 5000)
      }

      oracledb.createPool({
        user: options.user,
        password: options.password,
        connectString: options.connection
      }, (connectionError, connectionPool) => {
        if (connectionError) {
          console.error('Error connecting to Oracle Database Server.', connectionError)
          _plugin.logException(connectionError)

          return setTimeout(() => {
            process.exit(1)
          }, 5000)
        }

        pool = connectionPool

        _plugin.log('Connected to Oracle Database Server.')
        process.send({ type: 'ready' })
      })
    })
  })
})
