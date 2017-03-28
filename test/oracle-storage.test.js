/* global describe, it, before, after */
'use strict'

const amqp = require('amqplib')
const should = require('should')
const moment = require('moment')

const _ID = new Date().getTime()
const INPUT_PIPE = 'demo.pipe.storage'
const BROKER = 'amqp://guest:guest@127.0.0.1/'

let conf = {
  connection: 'reekoh-oracle.cg1corueo9zh.us-east-1.rds.amazonaws.com:1521/ORCL',
  user: 'reekoh',
  password: 'rozzwalla',
  schema: 'REEKOH',
  table: 'REEKOH_TABLE',
  fieldMapping: '??'
}

let _app = null
let _conn = null
let _channel = null

let record = {
  id: _ID,
  co2: '11%',
  temp: 23,
  quality: 11.25,
  reading_time: (new Date()),
  metadata: {
    metadata_json: 'reekoh metadata json'
  },
  random_data: 'abcdefg',
  is_normal: true
}

describe('Oracle Storage', function () {

  before('init', () => {
    process.env.BROKER = BROKER
    process.env.INPUT_PIPE = INPUT_PIPE
    process.env.CONFIG = JSON.stringify(conf)

    amqp.connect(BROKER).then((conn) => {
      _conn = conn
      return conn.createChannel()
    }).then((channel) => {
      _channel = channel
    }).catch((err) => {
      console.log(err)
    })
  })

  after('terminate', function () {
    _conn.close()
  })

  describe('#start', function () {
    it('should start the app', function (done) {
      this.timeout(10000)
      _app = require('../app')
      _app.once('init', done)
    })
  })

  describe('#data', function () {
    it('should process the data', function (done) {
      this.timeout(10000)
      _channel.sendToQueue(INPUT_PIPE, new Buffer(JSON.stringify(record)))
      _app.on('processed', done)
    })
  })

  describe('#data', function () {
    it('should have inserted the data', function (done) {
      this.timeout(10000)

      let oracledb = require('oracledb')

      oracledb.outFormat = oracledb.OBJECT

      let config = {
        user: conf.user,
        password: conf.password,
        connectString: conf.connection
      }

      oracledb.getConnection(config, function (err, connection) {
        if (err) return console.log(err)
        connection.execute('SELECT * FROM ' + conf.table + ' WHERE id = ' + _ID, [], {}, function (queryError, result) {
          should.ifError(queryError)

          should.exist(result.rows[0])
          let resp = result.rows[0]

          should.equal(record.co2, resp.CO2_FIELD, 'Data validation failed. Field: co2')
          should.equal(record.temp, resp.TEMP_FIELD, 'Data validation failed. Field: temp')
          should.equal(record.quality, resp.QUALITY_FIELD, 'Data validation failed. Field: quality')
          should.equal(record.random_data, resp.RANDOM_DATA_FIELD, 'Data validation failed. Field: random_data')
          should.equal(moment(record.reading_time).format('YYYY-MM-DD HH:mm:ss'), moment(resp.READING_TIME_FIELD).format('YYYY-MM-DD HH:mm:ss'), 'Data validation failed. Field: reading_time')
          should.equal(JSON.stringify(record.metadata), resp.METADATA_FIELD, 'Data validation failed. Field: metadata')

          done()
        })
      })
    })
  })
})
