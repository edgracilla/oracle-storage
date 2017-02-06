/* global describe, it, before, after */
'use strict'

const amqp = require('amqplib')
const should = require('should')
const moment = require('moment')
const cp = require('child_process')

let _storage = null
let _channel = null
let _conn = null

let _ID = new Date().getTime()

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

describe('Storage', function () {
  this.slow(5000)

  before('init', () => {
    process.env.INPUT_PIPE = 'demo.pipe.storage'
    process.env.BROKER = 'amqp://guest:guest@127.0.0.1/'

    process.env.ORACLE_USER = 'reekoh'
    process.env.ORACLE_PASSWORD = 'rozzwalla'
    process.env.ORACLE_SCHEMA = 'REEKOH'
    process.env.ORACLE_TABLE = 'REEKOH_TABLE'
    process.env.ORACLE_CONNECTION = 'reekoh-oracle.cg1corueo9zh.us-east-1.rds.amazonaws.com:1521/ORCL'

    amqp.connect(process.env.BROKER)
      .then((conn) => {
        _conn = conn
        return conn.createChannel()
      }).then((channel) => {
        _channel = channel
      }).catch((err) => {
        console.log(err)
      })
  })

  after('terminate child process', function () {
    _conn.close()
    _storage.kill('SIGKILL')
  })

  describe('#spawn', function () {
    it('should spawn a child process', function () {
      should.ok(_storage = cp.fork(process.cwd()), 'Child process not spawned.')
    })
  })

  describe('#handShake', function () {
    it('should notify the parent process when ready within 5 seconds', function (done) {
      this.timeout(5000)

      _storage.on('message', function (message) {
        if (message.type === 'ready') {
          done()
        }
      })
    })
  })

  describe('#data', function () {
    it('should process the data', function (done) {
      this.timeout(8000)

      _channel.sendToQueue(process.env.INPUT_PIPE, new Buffer(JSON.stringify(record)))

      _storage.on('message', (msg) => {
        if (msg.type === 'processed') done()
      })

    })
  })

  describe('#data', function () {
    it('should have inserted the data', function (done) {
      this.timeout(10000)

      let oracledb = require('oracledb')

      oracledb.outFormat = oracledb.OBJECT

      let config = {
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectString: process.env.ORACLE_CONNECTION
      }

      oracledb.getConnection(config, function (err, connection) {
        if (err) return console.log(err)
        connection.execute('SELECT * FROM ' + process.env.ORACLE_TABLE + ' WHERE id = ' + _ID, [], {}, function (queryError, result) {
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
