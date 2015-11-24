# Oralce Storage

[![Build Status](https://travis-ci.org/Reekoh/oracle-storage.svg)](https://travis-ci.org/Reekoh/oracle-storage)
![Dependencies](https://img.shields.io/david/Reekoh/oracle-storage.svg)
![Dependencies](https://img.shields.io/david/dev/Reekoh/oracle-storage.svg)
![Built With](https://img.shields.io/badge/built%20with-gulp-red.svg)

Oracle Storage Plugin for the Reekoh IoT Platform.

## Assumptions:

1. Data would be in JSON format
2. Data would be processed based on configuration format
3. Conversions and formatting are done within Reekoh only minimal conversions are done in the plugin
4. Field configuration is correctly done for the specified table

## Process

1. Data would be written directly to the Oracle host specified
2. Storage plugin will only write data using plain SQL-Insert statement
3. All errors will be logged and no data should be written
4. Data will be parsed accordingly based on field configuration

## Field Configuration

1. Input for this field is in JSON format {"(field_name)" : {"source_field" : "value", "data_type": "value", "format": "value"}}.
2. field_name will be the name of the column in the oracle Table
3  source_field (required) value will be the name of the field in the JSON Data passed to the plugin
4  data_type there are 6 available data types that will convert data to it's proper type before saving
   we have String, Integer, Float, Boolean, Timestamp & Date leaving this blank will just use the current data for the field
5. format is only available for Timestamp & Date data_type it uses the TO_TIMESTAMP AND TO_DATE functions of the Oracle
   platform. Ensure that the date/time being passed is valid. default format used are
   (yyyy-mm-dd hh24:mi:ss.ff / yyyy-mm-dd)
6. JSON Data is not supported as a data_type but you can save it if there is a field in oracle

```javascript
{
  "co2_field": {
	"source_field": "co2",
	"data_type": "String"
  },
  "temp_field": {
	"source_field": "temp",
	"data_type": "Integer"
  },
  "quality_field": {
	"source_field": "quality",
	"data_type": "Float"
  },
  "metadata_field": {
	"source_field": "metadata",
	"data_type": "JSON"
  },
  "reading_time_field": {
	"source_field": "reading_time",
	"data_type": "Timestamp",
	"format": "yyyy-mm-dd hh24:mi:ss.ff"
  },
  "random_data_field": {
	"source_field": "random_data"
  },
  "is_normal_field": {
	"source_field": "is_normal",
	"data_type": "Boolean"
  }
}
```

### Sample Data:

```javascript
{
  co2: '11%',
  temp: 23,
  quality: 11.25,
  metadata: '{"name": "warehouse air conditioning"}',
  reading_time: '2015-11-27 11:04:13.539',
  random_data: 'abcdefg',
  is_normal: true
}
```

### Oracle Fields:

Type Field mapping |
-------------------|
_id                |
co2_field          |
temp_field         |
quality_field      |
metadata_field     |
reading_time_field |
random_data_field  |
is_normal_field    |
